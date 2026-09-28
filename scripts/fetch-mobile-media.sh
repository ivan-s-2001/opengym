#!/usr/bin/env bash
# Prepare the complete exercises-dataset media tree for a truly offline Capacitor build.
# Network is used only here, at build time. The resulting APK contains every JPG and GIF.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATASET_REPO="https://github.com/hasaneyldrm/exercises-dataset.git"
DATASET_COMMIT="7455efae41b330c265e7cd4b78dfa848e7ce5ebd"
PUBLIC="$ROOT/frontend/public"
TMP="$(mktemp -d)"

trap 'rm -rf "$TMP"' EXIT

echo "Fetching exercises-dataset $DATASET_COMMIT..."
git -C "$TMP" init -q
git -C "$TMP" remote add origin "$DATASET_REPO"
git -C "$TMP" fetch -q --depth 1 origin "$DATASET_COMMIT"
git -C "$TMP" checkout -q FETCH_HEAD

rm -rf "$PUBLIC/img" "$PUBLIC/gif"
mkdir -p "$PUBLIC/img" "$PUBLIC/gif"
cp "$TMP"/images/*.jpg "$PUBLIC/img/"
cp "$TMP"/videos/*.gif "$PUBLIC/gif/"

images="$(find "$PUBLIC/img" -maxdepth 1 -type f -name '*.jpg' | wc -l | tr -d ' ')"
gifs="$(find "$PUBLIC/gif" -maxdepth 1 -type f -name '*.gif' | wc -l | tr -d ' ')"

if [ "$images" -lt 1324 ] || [ "$gifs" -lt 1324 ]; then
  echo "Offline media incomplete: $images JPG, $gifs GIF" >&2
  exit 1
fi

echo "Offline media ready: $images JPG, $gifs GIF"
