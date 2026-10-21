#!/usr/bin/env bash
set -euo pipefail

args=(--no-sandbox)
if [[ -n "${QQB_UIN:-}" ]]; then
  args+=(-q "$QQB_UIN")
fi

exec xvfb-run -a /root/Napcat/opt/QQ/qq "${args[@]}"
