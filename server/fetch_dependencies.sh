#!/usr/bin/env bash
set -euo pipefail

ROOT="${QQB_ROOT:-/opt/qqb}"
ASTRBOT_DIR="${ASTRBOT_DIR:-$ROOT/AstrBot-master}"
PLUGINS_DIR="${ASTRBOT_PLUGINS_DIR:-$ASTRBOT_DIR/data/plugins}"

clone_pinned() {
  local repo="$1" ref="$2" commit="$3" destination="$4"
  if [[ -e "$destination" ]]; then
    echo "Refusing to overwrite existing path: $destination" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$destination")"
  git clone --depth 1 --branch "$ref" "https://github.com/$repo.git" "$destination"
  local actual
  actual="$(git -C "$destination" rev-parse HEAD)"
  if [[ "$actual" != "$commit" ]]; then
    echo "Pinned revision mismatch for $repo: expected $commit, got $actual" >&2
    exit 1
  fi
}

clone_pinned "AstrBotDevs/AstrBot" "v4.29.1" \
  "dffe922773725e9c178392c423676ad65044748c" "$ASTRBOT_DIR"

mkdir -p "$PLUGINS_DIR"
clone_pinned "menglimi/astrbot_plugin_private_companion" "v6.7.0" \
  "f2f87183993a0667800056f73bcf12df298cdbcb" "$PLUGINS_DIR/astrbot_plugin_private_companion"
clone_pinned "menglimi/astrbot_plugin_memory_companion" "v2.3.2" \
  "8cff40d217438d5c0ac1b9a1fe6f935d1f46a5c1" "$PLUGINS_DIR/astrbot_plugin_memory_companion"
clone_pinned "menglimi/astrbot_plugin_content_companion" "v0.2.2" \
  "6f226ce084cb6c5b539f03a2a074dd94fa87ddf5" "$PLUGINS_DIR/astrbot_plugin_content_companion"
clone_pinned "anka-afk/astrbot_plugin_meme_manager" "v5.1.0" \
  "b96d6bedecca6d0bef27b70261fd6f787116ee49" "$PLUGINS_DIR/astrbot_plugin_meme_manager"

echo "Pinned source checkouts created. Install dependencies and configure services separately."
