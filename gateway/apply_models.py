#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 model_config.json 同步成 AstrBot 的 provider（都指到本地网关的角色上）。"""
import json

CFG = "/opt/qqb/data/model_config.json"
AST = "/opt/qqb/AstrBot-master/data/cmd_config.json"

ROLES = [
    ("chat", "gw-chat", "主聊天"),
    ("background", "gw-bg", "后台"),
    ("deep", "gw-deep", "重要时刻"),
    ("explore", "gw-explore", "探索"),
]


def main():
    mc = json.load(open(CFG, encoding="utf-8"))
    cfg = json.load(open(AST, encoding="utf-8-sig"))
    models = {m.get("id"): m for m in mc.get("models", []) if m.get("enabled", True)}
    providers = []
    for role, pid, label in ROLES:
        r = (mc.get("roles") or {}).get(role) or {}
        chain = [mid for mid in (r.get("models") or []) if mid in models]
        if not chain:
            continue
        providers.append({
            "id": pid,
            "provider": "openai",
            "type": "openai_chat_completion",
            "provider_type": "chat_completion",
            "enable": True,
            "key": ["local-gateway"],
            "api_base": "http://127.0.0.1:6198/v1",
            "model": role,
            "timeout": 180,
            "proxy": "",
            "custom_headers": {},
        })
    cfg["provider"] = providers
    ps = cfg.setdefault("provider_settings", {})
    ps["enable"] = True
    ps["streaming_response"] = False
    json.dump(cfg, open(AST, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("OK: %d provider(s)" % len(providers))
    for p in providers:
        print(" - %s -> %s" % (p["id"], p["model"]))


if __name__ == "__main__":
    main()
