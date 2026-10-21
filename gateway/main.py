#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""QQ陪伴 · 本地模型网关
- 只监听 127.0.0.1，OpenAI 兼容
- 按“角色”路由：chat / background / deep / explore
- 每个角色有首选模型和备用模型（顺序尝试）
- 按模型单价记账，按角色/全局日预算硬拦截
- 纯标准库实现，1G 小机器也能跑
"""
import json
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = "/opt/qqb/data"
CFG_PATH = os.path.join(BASE, "model_config.json")
DB_PATH = os.path.join(BASE, "gateway.db")
LOG_PATH = "/opt/qqb/logs/gateway.log"
HOST, PORT = "127.0.0.1", 6198

DEFAULT_CFG = {
    "models": [],
    "roles": {
        "chat": {"name": "主聊天", "models": [], "daily_budget": 2.0},
        "background": {"name": "后台（记忆/生活）", "models": [], "daily_budget": 0.5},
        "deep": {"name": "重要时刻", "models": [], "daily_budget": 0.3},
        "explore": {"name": "探索/浏览", "models": [], "daily_budget": 0.2},
    },
    "global": {"daily_budget": 3.0, "alert_ratio": 0.8},
}


def log(msg):
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write("[%s] %s\n" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg))
    except Exception:
        pass


def load_cfg():
    try:
        with open(CFG_PATH, encoding="utf-8") as f:
            cfg = json.load(f)
        cfg.setdefault("models", [])
        cfg.setdefault("roles", {})
        cfg.setdefault("global", {})
        return cfg
    except Exception:
        return json.loads(json.dumps(DEFAULT_CFG))


def db():
    os.makedirs(BASE, exist_ok=True)
    c = sqlite3.connect(DB_PATH, timeout=10)
    c.execute(
        """CREATE TABLE IF NOT EXISTS usage(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            role TEXT, model_id TEXT,
            tokens_in INTEGER DEFAULT 0,
            tokens_out INTEGER DEFAULT 0,
            cost REAL DEFAULT 0,
            ok INTEGER DEFAULT 1,
            note TEXT DEFAULT ''
        )"""
    )
    c.commit()
    return c


def today_str():
    return time.strftime("%Y-%m-%d")


def spent_today(role=None):
    c = db()
    try:
        if role:
            row = c.execute(
                "SELECT COALESCE(SUM(cost),0) FROM usage WHERE date(ts)=date('now','localtime') AND role=?",
                (role,),
            ).fetchone()
        else:
            row = c.execute(
                "SELECT COALESCE(SUM(cost),0) FROM usage WHERE date(ts)=date('now','localtime')"
            ).fetchone()
        return float(row[0] or 0)
    finally:
        c.close()


def record(role, model_id, tin, tout, cost, ok=1, note=""):
    c = db()
    try:
        c.execute(
            "INSERT INTO usage(ts,role,model_id,tokens_in,tokens_out,cost,ok,note) VALUES(?,?,?,?,?,?,?,?)",
            (time.strftime("%Y-%m-%d %H:%M:%S"), role, model_id, tin, tout, cost, ok, note),
        )
        c.commit()
    finally:
        c.close()


def model_by_id(cfg, mid):
    for m in cfg.get("models", []):
        if m.get("id") == mid:
            return m
    return None


def price_of(m, which):
    try:
        return float(m.get("price_" + which) or 0)
    except Exception:
        return 0.0


def estimate_tokens(text):
    return max(1, len(text or "") // 3)


def call_openai(model, messages, max_tokens=None, temperature=None, timeout=120):
    base = (model.get("base_url") or "").rstrip("/")
    key = model.get("api_key") or ""
    if not base or not key or not model.get("model"):
        raise RuntimeError("模型配置不完整（base_url / api_key / model）")
    body = {"model": model["model"], "messages": messages, "stream": False}
    if max_tokens:
        body["max_tokens"] = int(max_tokens)
    if temperature is not None:
        body["temperature"] = float(temperature)
    req = urllib.request.Request(
        base + "/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": "Bearer " + key},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data


def route_call(cfg, role_name, messages, max_tokens=None, temperature=None):
    role = cfg["roles"].get(role_name) or cfg["roles"].get("chat") or {}
    chain = [mid for mid in (role.get("models") or []) if model_by_id(cfg, mid)]
    if not chain:
        return None, {"error": {"message": "角色「%s」还没有配置模型" % role.get("name", role_name), "type": "no_model"}}
    # 预算检查
    gb = float(cfg.get("global", {}).get("daily_budget") or 0)
    gspent = spent_today()
    if gb > 0 and gspent >= gb:
        return None, {"error": {"message": "今日总预算已用完（约 %.2f 元）" % gspent, "type": "budget_exceeded"}}
    rb = float(role.get("daily_budget") or 0)
    rspent = spent_today(role_name)
    if rb > 0 and rspent >= rb:
        return None, {"error": {"message": "「%s」今日预算已用完（约 %.2f 元）" % (role.get("name", role_name), rspent), "type": "budget_exceeded"}}

    errors = []
    for mid in chain:
        m = model_by_id(cfg, mid)
        t0 = time.time()
        try:
            data = call_openai(m, messages, max_tokens=max_tokens, temperature=temperature)
            usage = (data or {}).get("usage") or {}
            tin = int(usage.get("prompt_tokens") or 0) or estimate_tokens(json.dumps(messages, ensure_ascii=False))
            tout = int(usage.get("completion_tokens") or 0) or estimate_tokens(
                ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
            )
            cost = (tin * price_of(m, "in") + tout * price_of(m, "out")) / 1_000_000.0
            record(role_name, mid, tin, tout, cost, 1)
            log("OK role=%s model=%s %.1fs in=%d out=%d cost=%.4f" % (role_name, mid, time.time() - t0, tin, tout, cost))
            return data, None
        except urllib.error.HTTPError as e:
            detail = ""
            try:
                detail = e.read().decode("utf-8", "ignore")[:300]
            except Exception:
                pass
            errors.append("%s: HTTP %s %s" % (m.get("name", mid), e.code, detail))
            record(role_name, mid, 0, 0, 0, 0, "HTTP %s" % e.code)
            log("FAIL role=%s model=%s HTTP %s %s" % (role_name, mid, e.code, detail))
        except Exception as e:
            errors.append("%s: %s" % (m.get("name", mid), e))
            record(role_name, mid, 0, 0, 0, 0, str(e)[:120])
            log("FAIL role=%s model=%s %s" % (role_name, mid, e))
    return None, {"error": {"message": "所有备用模型都失败了：" + "；".join(errors[-3:]), "type": "all_failed"}}


def route_direct(cfg, model_id, messages, max_tokens=None, temperature=None):
    """按模型 ID 直连：每个模型独立计费，不再套场景角色。"""
    m = model_by_id(cfg, model_id)
    if not m:
        return None, {"error": {"message": "模型不存在：%s" % model_id, "type": "no_model"}}
    gb = float(cfg.get("global", {}).get("daily_budget") or 0)
    gspent = spent_today()
    if gb > 0 and gspent >= gb:
        return None, {"error": {"message": "今日总预算已用完（约 %.2f 元）" % gspent, "type": "budget_exceeded"}}
    t0 = time.time()
    try:
        data = call_openai(m, messages, max_tokens=max_tokens, temperature=temperature)
        usage = (data or {}).get("usage") or {}
        tin = int(usage.get("prompt_tokens") or 0) or estimate_tokens(json.dumps(messages, ensure_ascii=False))
        tout = int(usage.get("completion_tokens") or 0) or estimate_tokens(
            ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
        )
        cost = (tin * price_of(m, "in") + tout * price_of(m, "out")) / 1_000_000.0
        record("direct", model_id, tin, tout, cost, 1)
        log("OK direct model=%s %.1fs in=%d out=%d cost=%.4f" % (model_id, time.time() - t0, tin, tout, cost))
        return data, None
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8", "ignore")[:300]
        except Exception:
            pass
        record("direct", model_id, 0, 0, 0, 0, "HTTP %s" % e.code)
        log("FAIL direct model=%s HTTP %s %s" % (model_id, e.code, detail))
        return None, {"error": {"message": "%s: HTTP %s %s" % (m.get("name", model_id), e.code, detail), "type": "upstream_error"}}
    except Exception as e:
        record("direct", model_id, 0, 0, 0, 0, str(e)[:120])
        log("FAIL direct model=%s %s" % (model_id, e))
        return None, {"error": {"message": "%s: %s" % (m.get("name", model_id), e), "type": "upstream_error"}}



    req = urllib.request.Request(
        "https://api.deepseek.com/user/balance",
        headers={"Authorization": "Bearer " + (model.get("api_key") or "")},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    out = []
    for info in data.get("balance_infos") or []:
        out.append({
            "currency": info.get("currency"),
            "total": info.get("total_balance"),
            "topped": info.get("topped_up_balance"),
            "granted": info.get("granted_balance"),
        })
    return out


def console_url(model):
    if model.get("console"):
        return model["console"]
    try:
        host = urllib.parse.urlparse(model.get("base_url") or "").netloc
        if host.startswith("api."):
            host = "www." + host[4:]
        return "https://" + host if host else ""
    except Exception:
        return ""


def collect_balances():
    cfg = load_cfg()
    out = []
    seen = set()
    for m in cfg.get("models", []):
        base = m.get("base_url") or ""
        is_ds = m.get("balance") == "deepseek" or "api.deepseek.com" in base
        key = ("ds" if is_ds else "relay") + "|" + base + "|" + (m.get("api_key") or "")
        item = {"model_id": m.get("id"), "name": m.get("name"), "kind": "deepseek" if is_ds else "manual"}
        if is_ds:
            try:
                item["infos"] = deepseek_balance(m)
            except Exception as e:
                item["error"] = str(e)[:200]
        else:
            item["console"] = console_url(m)
        # 同一账号只显示一次，但保留所有用到它的模型名
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "QQBGateway/0.1"


    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        try:
            n = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(n).decode("utf-8") or "{}")
        except Exception:
            return {}

    def log_message(self, fmt, *args):
        pass

    def do_GET(self):
        if self.path.startswith("/health"):
            return self._send(200, {"ok": True, "ts": int(time.time())})
        if self.path.startswith("/v1/models"):
            cfg = load_cfg()
            data = [{"id": r, "object": "model", "owned_by": "qqb"} for r in cfg.get("roles", {})]
            return self._send(200, {"object": "list", "data": data})
        if self.path.startswith("/usage"):
            return self._send(200, self.usage())
        if self.path.startswith("/status"):
            return self._send(200, self.status())
        if self.path.startswith("/balance"):
            try:
                return self._send(200, {"ok": True, "balances": collect_balances()})
            except Exception as e:
                return self._send(500, {"ok": False, "error": str(e)})
        return self._send(404, {"error": {"message": "not found"}})

    def usage(self):
        """按模型统计今日用量；app 的费用页用这个，不再按场景角色。"""
        cfg = load_cfg()
        c = db()
        try:
            rows = c.execute(
                "SELECT model_id, COUNT(*), COALESCE(SUM(tokens_in),0), COALESCE(SUM(tokens_out),0), COALESCE(SUM(cost),0) "
                "FROM usage WHERE date(ts)=date('now','localtime') GROUP BY model_id"
            ).fetchall()
        finally:
            c.close()
        by_id = {m.get("id"): m for m in (cfg.get("models") or [])}
        items = []
        total_tokens = 0
        total_cost = 0.0
        total_calls = 0
        for mid, calls, tin, tout, cost in rows:
            m = by_id.get(mid) or {}
            tin, tout, cost, calls = int(tin), int(tout), float(cost), int(calls)
            total_tokens += tin + tout
            total_cost += cost
            total_calls += calls
            items.append({
                "model_id": mid,
                "name": m.get("name") or mid,
                "api_model": m.get("model") or mid,
                "calls": calls,
                "tokens_in": tin,
                "tokens_out": tout,
                "tokens_total": tin + tout,
                "cost": round(cost, 4),
            })
        items.sort(key=lambda x: x["cost"], reverse=True)
        return {
            "ok": True,
            "date": today_str(),
            "total": {"calls": total_calls, "tokens": total_tokens, "cost": round(total_cost, 4)},
            "items": items,
        }

    def status(self):
        cfg = load_cfg()
        roles = {}
        for rname, r in (cfg.get("roles") or {}).items():
            budget = float(r.get("daily_budget") or 0)
            spent = spent_today(rname)
            roles[rname] = {
                "name": r.get("name", rname),
                "models": [mid for mid in (r.get("models") or []) if model_by_id(cfg, mid)],
                "budget": budget,
                "spent": round(spent, 4),
                "remaining": round(max(0.0, budget - spent), 4) if budget > 0 else None,
            }
        gb = float(cfg.get("global", {}).get("daily_budget") or 0)
        gs = spent_today()
        c = db()
        try:
            cnt = c.execute(
                "SELECT COUNT(*) FROM usage WHERE date(ts)=date('now','localtime')"
            ).fetchone()[0]
        finally:
            c.close()
        return {
            "ok": True,
            "date": today_str(),
            "global": {"budget": gb, "spent": round(gs, 4), "remaining": round(max(0.0, gb - gs), 4) if gb > 0 else None},
            "roles": roles,
            "calls_today": cnt,
        }

    def do_POST(self):
        if self.path.startswith("/test"):
            body = self._read_json()
            m = {
                "id": "test",
                "name": body.get("name") or "test",
                "base_url": body.get("base_url"),
                "api_key": body.get("api_key"),
                "model": body.get("model"),
                "price_in": body.get("price_in") or 0,
                "price_out": body.get("price_out") or 0,
            }
            t0 = time.time()
            try:
                data = call_openai(m, [{"role": "user", "content": "只回复两个字：正常"}], max_tokens=16, temperature=0)
                content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
                return self._send(200, {"ok": True, "latency_ms": int((time.time() - t0) * 1000), "content": content})
            except Exception as e:
                return self._send(200, {"ok": False, "latency_ms": int((time.time() - t0) * 1000), "error": str(e)[:400]})
        if self.path.startswith("/fetch_models"):
            body = self._read_json()
            base = (body.get("base_url") or "").rstrip("/")
            key = body.get("api_key") or ""
            try:
                req = urllib.request.Request(
                    base + "/models", headers={"Authorization": "Bearer " + key}, method="GET"
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                ids = [x.get("id") for x in (data.get("data") or []) if x.get("id")]
                return self._send(200, {"ok": True, "models": ids})
            except Exception as e:
                return self._send(200, {"ok": False, "error": str(e)[:300]})
        if self.path.startswith("/v1/chat/completions"):
            body = self._read_json()
            requested = body.get("model") or "chat"
            messages = body.get("messages") or []
            cfg = load_cfg()
            if model_by_id(cfg, requested):
                data, err = route_direct(
                    cfg, requested, messages,
                    max_tokens=body.get("max_tokens"),
                    temperature=body.get("temperature"),
                )
                role = requested
            else:
                role = requested
                if role not in (cfg.get("roles") or {}):
                    role = "chat"
                data, err = route_call(
                    cfg, role, messages,
                    max_tokens=body.get("max_tokens"),
                    temperature=body.get("temperature"),
                )
            if err:
                return self._send(429 if err["error"].get("type") == "budget_exceeded" else 502, err)
            if body.get("stream"):
                content = ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "")
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Cache-Control", "no-cache")
                self.end_headers()
                chunk = {
                    "id": "chatcmpl-gw", "object": "chat.completion.chunk",
                    "created": int(time.time()), "model": role,
                    "choices": [{"index": 0, "delta": {"role": "assistant", "content": content}, "finish_reason": None}],
                }
                self.wfile.write(("data: " + json.dumps(chunk, ensure_ascii=False) + "\n\n").encode("utf-8"))
                end = {"id": "chatcmpl-gw", "object": "chat.completion.chunk", "created": int(time.time()),
                       "model": role, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
                self.wfile.write(("data: " + json.dumps(end, ensure_ascii=False) + "\n\ndata: [DONE]\n\n").encode("utf-8"))
                return
            return self._send(200, data)
        return self._send(404, {"error": {"message": "not found"}})


def main():
    os.makedirs(BASE, exist_ok=True)
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    if not os.path.exists(CFG_PATH):
        with open(CFG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CFG, f, ensure_ascii=False, indent=2)
    db().close()
    log("gateway start on %s:%d" % (HOST, PORT))
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
