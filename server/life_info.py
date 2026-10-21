#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""输出生活系统当前状态，供本地控制台读取。"""
import json
import sqlite3
from pathlib import Path

BASE = Path("/opt/qqb/AstrBot-master/data/plugins/astrbot_plugin_life_engine")
DB = BASE / "data" / "life.db"
PERSONA = BASE / "persona.json"


def main():
    out = {"ok": True, "persona": {}, "state": {}, "events": [], "messages": []}
    try:
        out["persona"] = json.loads(PERSONA.read_text(encoding="utf-8"))
    except Exception:
        out["persona"] = {}
    if not DB.exists():
        out["ok"] = False
        out["error"] = "life.db 不存在"
        print(json.dumps(out, ensure_ascii=False))
        return
    c = sqlite3.connect(DB)
    c.row_factory = sqlite3.Row
    try:
        r = c.execute("SELECT * FROM state WHERE id=1").fetchone()
        if r:
            out["state"] = dict(r)
        out["events"] = [
            dict(x) for x in c.execute("SELECT ts, content FROM events ORDER BY id DESC LIMIT 12")
        ]
        out["messages"] = [
            dict(x) for x in c.execute("SELECT ts, role, content FROM messages ORDER BY id DESC LIMIT 12")
        ]
        out["memories"] = [
            dict(x) for x in c.execute("SELECT ts, content FROM memories ORDER BY id DESC LIMIT 12")
        ]
    finally:
        c.close()
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
