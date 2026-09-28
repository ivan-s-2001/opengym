package ch.duartesantos.opengym;

import android.accounts.Account;
import android.app.Activity;
import android.app.PendingIntent;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.common.api.Scope;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.ProtocolException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Tiny native bridge for openGym's optional Google Drive backup.
 *
 * No openGym server is involved. Google Identity Services provides a short-lived access token
 * for the non-sensitive drive.appdata scope and Drive API v3 stores one JSON file in the app's
 * private appDataFolder. Other Drive files are not visible to this app.
 */
@CapacitorPlugin(name = "GoogleDriveBackup")
public class GoogleDriveBackupPlugin extends Plugin {
    private static final String SCOPE = "https://www.googleapis.com/auth/drive.appdata";
    private static final String FILE_NAME = "opengym-backup.json";
    private static final String PREFS = "opengym_google_drive";
    private static final String PREF_ACCOUNT = "account";

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final List<Scope> scopes = Collections.singletonList(new Scope(SCOPE));

    private AuthorizationClient auth;
    private ActivityResultLauncher<IntentSenderRequest> authLauncher;
    private PluginCall pendingConnect;

    @Override
    public void load() {
        auth = Identity.getAuthorizationClient(getActivity());
        authLauncher = bridge.registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            this::finishAuthorization
        );
    }

    @Override
    protected void handleOnDestroy() {
        io.shutdown();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        AuthorizationRequest request = AuthorizationRequest.builder()
            .setRequestedScopes(scopes)
            .setPrompt(AuthorizationRequest.Prompt.SELECT_ACCOUNT)
            .build();

        auth.authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution()) {
                    launchAuthorization(call, result.getPendingIntent());
                    return;
                }
                rememberAccount(result);
                resolveConnected(call);
            })
            .addOnFailureListener(e -> reject(call, "AUTH_FAILED", e));
    }

    @PluginMethod
    public void status(PluginCall call) {
        Account account = savedAccount();
        if (account == null) {
            JSObject out = new JSObject();
            out.put("connected", false);
            call.resolve(out);
            return;
        }

        AuthorizationRequest request = AuthorizationRequest.builder()
            .setAccount(account)
            .setRequestedScopes(scopes)
            .build();

        auth.authorize(request)
            .addOnSuccessListener(result -> {
                JSObject out = new JSObject();
                out.put("connected", !result.hasResolution() && result.getAccessToken() != null);
                call.resolve(out);
            })
            .addOnFailureListener(e -> {
                JSObject out = new JSObject();
                out.put("connected", false);
                call.resolve(out);
            });
    }

    @PluginMethod
    public void backup(PluginCall call) {
        String json = call.getString("json");
        if (json == null || json.isEmpty()) {
            call.reject("Backup JSON is empty", "INVALID_BACKUP");
            return;
        }

        withToken(call, token -> io.execute(() -> {
            try {
                FileMeta meta = newestBackup(token);
                String fileId = meta == null ? createBackupFile(token) : meta.id;
                uploadBackup(token, fileId, json);
                JSObject out = new JSObject();
                out.put("ok", true);
                out.put("fileId", fileId);
                out.put("savedAt", System.currentTimeMillis());
                resolveOnMain(call, out);
            } catch (Exception e) {
                rejectOnMain(call, "DRIVE_BACKUP_FAILED", e);
            }
        }));
    }

    @PluginMethod
    public void restore(PluginCall call) {
        withToken(call, token -> io.execute(() -> {
            try {
                FileMeta meta = newestBackup(token);
                if (meta == null) {
                    rejectOnMain(call, "NO_BACKUP", new IOException("No Google Drive backup found"));
                    return;
                }
                String json = request("GET",
                    "https://www.googleapis.com/drive/v3/files/" + meta.id + "?alt=media",
                    token, null, null, null);
                JSObject out = new JSObject();
                out.put("json", json);
                out.put("modifiedTime", meta.modifiedTime);
                out.put("fileId", meta.id);
                resolveOnMain(call, out);
            } catch (Exception e) {
                rejectOnMain(call, "DRIVE_RESTORE_FAILED", e);
            }
        }));
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Account account = savedAccount();
        getContext().getSharedPreferences(PREFS, 0).edit().remove(PREF_ACCOUNT).apply();

        if (account == null) {
            JSObject out = new JSObject();
            out.put("connected", false);
            call.resolve(out);
            return;
        }

        RevokeAccessRequest request = RevokeAccessRequest.builder()
            .setAccount(account)
            .setScopes(scopes)
            .build();

        auth.revokeAccess(request)
            .addOnCompleteListener(task -> {
                JSObject out = new JSObject();
                out.put("connected", false);
                call.resolve(out);
            });
    }

    private void withToken(PluginCall call, TokenConsumer consumer) {
        Account account = savedAccount();
        if (account == null) {
            call.reject("Connect Google Drive first", "AUTH_REQUIRED");
            return;
        }

        AuthorizationRequest request = AuthorizationRequest.builder()
            .setAccount(account)
            .setRequestedScopes(scopes)
            .build();

        auth.authorize(request)
            .addOnSuccessListener(result -> {
                if (result.hasResolution() || result.getAccessToken() == null) {
                    call.reject("Google Drive authorization needs user interaction", "AUTH_REQUIRED");
                    return;
                }
                rememberAccount(result);
                consumer.accept(result.getAccessToken());
            })
            .addOnFailureListener(e -> reject(call, "AUTH_FAILED", e));
    }

    private void launchAuthorization(PluginCall call, PendingIntent pendingIntent) {
        if (pendingIntent == null) {
            call.reject("Google authorization did not provide a resolution", "AUTH_FAILED");
            return;
        }
        pendingConnect = call;
        IntentSenderRequest request = new IntentSenderRequest.Builder(pendingIntent.getIntentSender()).build();
        authLauncher.launch(request);
    }

    private void finishAuthorization(ActivityResult activityResult) {
        PluginCall call = pendingConnect;
        pendingConnect = null;
        if (call == null) return;

        if (activityResult.getResultCode() != Activity.RESULT_OK || activityResult.getData() == null) {
            call.reject("Google Drive connection cancelled", "AUTH_CANCELLED");
            return;
        }

        try {
            AuthorizationResult result = auth.getAuthorizationResultFromIntent(activityResult.getData());
            if (result.getAccessToken() == null) {
                call.reject("Google Drive did not return an access token", "AUTH_FAILED");
                return;
            }
            rememberAccount(result);
            resolveConnected(call);
        } catch (Exception e) {
            reject(call, "AUTH_FAILED", e);
        }
    }

    private void rememberAccount(AuthorizationResult result) {
        GoogleSignInAccount google = result.toGoogleSignInAccount();
        Account account = google == null ? null : google.getAccount();
        if (account != null && account.name != null) {
            getContext().getSharedPreferences(PREFS, 0)
                .edit().putString(PREF_ACCOUNT, account.name).apply();
        }
    }

    private Account savedAccount() {
        String name = getContext().getSharedPreferences(PREFS, 0).getString(PREF_ACCOUNT, null);
        return name == null || name.isEmpty() ? null : new Account(name, "com.google");
    }

    private void resolveConnected(PluginCall call) {
        JSObject out = new JSObject();
        out.put("connected", true);
        Account account = savedAccount();
        if (account != null) out.put("account", account.name);
        call.resolve(out);
    }

    private FileMeta newestBackup(String token) throws Exception {
        String query = URLEncoder.encode("name = '" + FILE_NAME + "'", StandardCharsets.UTF_8.toString());
        String url = "https://www.googleapis.com/drive/v3/files"
            + "?spaces=appDataFolder"
            + "&q=" + query
            + "&orderBy=modifiedTime%20desc"
            + "&pageSize=1"
            + "&fields=files(id,name,modifiedTime,size)";

        JSONObject root = new JSONObject(request("GET", url, token, null, null, null));
        JSONArray files = root.optJSONArray("files");
        if (files == null || files.length() == 0) return null;
        JSONObject f = files.getJSONObject(0);
        return new FileMeta(f.getString("id"), f.optString("modifiedTime", ""));
    }

    private String createBackupFile(String token) throws Exception {
        JSONObject meta = new JSONObject();
        meta.put("name", FILE_NAME);
        meta.put("mimeType", "application/json");
        JSONArray parents = new JSONArray();
        parents.put("appDataFolder");
        meta.put("parents", parents);

        JSONObject created = new JSONObject(request(
            "POST",
            "https://www.googleapis.com/drive/v3/files?fields=id",
            token,
            meta.toString(),
            "application/json; charset=UTF-8",
            null
        ));
        return created.getString("id");
    }

    private void uploadBackup(String token, String fileId, String json) throws Exception {
        request(
            "PATCH",
            "https://www.googleapis.com/upload/drive/v3/files/" + fileId + "?uploadType=media",
            token,
            json,
            "application/json; charset=UTF-8",
            null
        );
    }

    private String request(
        String method,
        String url,
        String token,
        String body,
        String contentType,
        String overrideMethod
    ) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("Authorization", "Bearer " + token);
        conn.setRequestProperty("Accept", "application/json");

        try {
            conn.setRequestMethod(method);
        } catch (ProtocolException e) {
            if (!"PATCH".equals(method)) throw e;
            conn.setRequestMethod("POST");
            conn.setRequestProperty("X-HTTP-Method-Override", "PATCH");
        }
        if (overrideMethod != null) conn.setRequestProperty("X-HTTP-Method-Override", overrideMethod);

        if (body != null) {
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", contentType == null ? "application/json; charset=UTF-8" : contentType);
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }
        }

        int code = conn.getResponseCode();
        InputStream stream = code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream();
        String response = read(stream);
        conn.disconnect();

        if (code < 200 || code >= 300) {
            throw new IOException("Drive API " + code + (response.isEmpty() ? "" : ": " + response));
        }
        return response;
    }

    private String read(InputStream stream) throws IOException {
        if (stream == null) return "";
        StringBuilder out = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) out.append(line).append('\n');
        }
        return out.toString();
    }

    private void resolveOnMain(PluginCall call, JSObject value) {
        getActivity().runOnUiThread(() -> call.resolve(value));
    }

    private void rejectOnMain(PluginCall call, String code, Exception e) {
        getActivity().runOnUiThread(() -> reject(call, code, e));
    }

    private void reject(PluginCall call, String code, Exception e) {
        call.reject(e.getMessage() == null ? code : e.getMessage(), code, e);
    }

    private interface TokenConsumer {
        void accept(String token);
    }

    private static final class FileMeta {
        final String id;
        final String modifiedTime;

        FileMeta(String id, String modifiedTime) {
            this.id = id;
            this.modifiedTime = modifiedTime;
        }
    }
}
