# -*- coding: utf-8 -*-
"""生活系统插件 v0.2
- 人设注入
- 状态：心情 / 精力 / 亲密度 / 当前活动
- 日程：按时间自动切换“在做什么”
- 生活事件：定时生成，聊天时可自然提起
- 简单长期记忆：记录“关于你”的句子，聊天时注入
- 主动消息：在允许时段、低频地分享生活（默认每天最多 2 条）
"""
import asyncio
import json
import random
import sqlite3
from datetime import datetime
from pathlib import Path

from astrbot.api import logger
from astrbot.api.event import filter, AstrMessageEvent
from astrbot.api.message_components import Plain
from astrbot.api.star import Context, Star, register
from astrbot.core.message.message_event_result import MessageChain
from astrbot.core.provider.entities import ProviderRequest

PLUGIN_NAME = "astrbot_plugin_life_engine"
TICK_SECONDS = 300
WEEKDAYS = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"]

EVENT_TEMPLATES = [
    "刷到一个很离谱的装修视频，笑死",
    "下午画稿卡住了，出去买了一杯冰美式",
    "桌上的东西被碰掉了，肇事者还装作若无其事",
    "在听一张很老的专辑，循环了一下午",
    "发现楼下新开了一家面包店，买了可颂",
    "刚改完一张稿，被甲方要求再改一版",
    "今天有点闷，想下场雨",
    "看了半部老电影，没看完就睡着了",
    "把房间收拾了一遍，扔掉了很多东西",
    "突然想吃火锅，但一个人又懒得去",
]

PROACTIVE_OPENERS = [
    "对了，",
    "刚想到，",
    "跟你说个事，",
    "今天",
]

DEFAULT_SETTINGS = {
    "proactive_enabled": False,
    "proactive_day_start": 10,
    "proactive_day_end": 22,
    "proactive_min_interval_hours": 4,
    "proactive_chance_per_tick": 0.02,
    "proactive_max_per_day": 2,
}

MEMORY_KEYS = ["我", "喜欢", "讨厌", "生日", "工作", "住", "叫", "想", "习惯"]


def _mood_text(m):
    if m >= 30:
        return "心情不错"
    if m >= 10:
        return "还算平静"
    if m >= -10:
        return "有点平淡"
    if m >= -30:
        return "有点闷"
    return "心情不太好"


@register(PLUGIN_NAME, "qqb", "陪伴生活系统", "0.2.0")
class LifeEngine(Star):
    def __init__(self, context: Context):
        super().__init__(context)
        self.dir = Path(__file__).parent
        self.data_dir = self.dir / "data"
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "life.db"
        self.persona = self._load_json(self.dir / "persona.json", {})
        self.settings = {**DEFAULT_SETTINGS, **self._load_json(self.data_dir / "settings.json", {})}
        self._persona_path = self.dir / "persona.json"
        self._settings_path = self.data_dir / "settings.json"
        self._persona_mtime = self._mtime(self._persona_path)
        self._settings_mtime = self._mtime(self._settings_path)
        self._init_db()
        self._task = None
        self._start_tick()
        logger.info(f"[life] 生活系统 v0.2 已加载，人设：{self.persona.get('name')}")

    def _load_json(self, p, default):
        try:
            return json.loads(Path(p).read_text(encoding="utf-8"))
        except Exception:
            return default

    def _mtime(self, p):
        try:
            return Path(p).stat().st_mtime
        except Exception:
            return 0

    def _reload_persona(self):
        try:
            m = self._mtime(self._persona_path)
            if m != self._persona_mtime:
                self.persona = self._load_json(self._persona_path, self.persona)
                self._persona_mtime = m
                logger.info("[life] 人设已热更新")
        except Exception as e:
            logger.error(f"[life] 人设热更新失败：{e}")

    def _reload_settings(self):
        try:
            m = self._mtime(self._settings_path)
            if m != self._settings_mtime:
                self.settings = {**DEFAULT_SETTINGS, **self._load_json(self._settings_path, {})}
                self._settings_mtime = m
                logger.info("[life] 主动消息设置已热更新")
        except Exception as e:
            logger.error(f"[life] 设置热更新失败：{e}")

    def _start_tick(self):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running() and self._task is None:
                self._task = loop.create_task(self._tick_loop())
        except Exception as e:
            logger.warning(f"[life] tick 启动失败（稍后重试）：{e}")

    async def _tick_loop(self):
        await asyncio.sleep(20)
        while True:
            try:
                self.tick()
                await self._maybe_proactive()
            except Exception as e:
                logger.error(f"[life] tick 出错：{e}")
            await asyncio.sleep(TICK_SECONDS)

    def _conn(self):
        c = sqlite3.connect(self.db_path, timeout=10)
        c.row_factory = sqlite3.Row
        return c

    def _init_db(self):
        c = self._conn()
        try:
            c.executescript(
                """
                CREATE TABLE IF NOT EXISTS state(
                    id INTEGER PRIMARY KEY CHECK(id=1),
                    mood INTEGER DEFAULT 0,
                    energy INTEGER DEFAULT 70,
                    intimacy INTEGER DEFAULT 5,
                    stage TEXT DEFAULT '初识',
                    activity TEXT DEFAULT '在发呆',
                    last_user_at TEXT DEFAULT '',
                    last_bot_at TEXT DEFAULT '',
                    last_umo TEXT DEFAULT '',
                    last_proactive_at TEXT DEFAULT '',
                    proactive_day TEXT DEFAULT '',
                    proactive_count INTEGER DEFAULT 0,
                    birth_at TEXT DEFAULT '',
                    updated_at TEXT DEFAULT ''
                );
                CREATE TABLE IF NOT EXISTS events(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT, source TEXT, content TEXT, shared INTEGER DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS messages(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT, role TEXT, content TEXT
                );
                CREATE TABLE IF NOT EXISTS memories(
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts TEXT, content TEXT
                );
                """
            )
            # 兼容旧库：补列
            cols = {r["name"] for r in c.execute("PRAGMA table_info(state)")}
            for name, ddl in [
                ("last_umo", "TEXT DEFAULT ''"),
                ("last_proactive_at", "TEXT DEFAULT ''"),
                ("proactive_day", "TEXT DEFAULT ''"),
                ("proactive_count", "INTEGER DEFAULT 0"),
            ]:
                if name not in cols:
                    c.execute(f"ALTER TABLE state ADD COLUMN {name} {ddl}")
            row = c.execute("SELECT id FROM state WHERE id=1").fetchone()
            if not row:
                now = self._now()
                c.execute(
                    "INSERT INTO state(id,birth_at,updated_at) VALUES(1,?,?)",
                    (now, now),
                )
            c.commit()
        finally:
            c.close()

    def _now(self):
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _activity(self, hour):
        if hour < 7:
            return "在睡觉"
        if hour < 8:
            return "刚起床，在洗漱"
        if hour < 9:
            return "在吃早饭，准备开始干活"
        if hour < 12:
            return "在画稿"
        if hour < 13:
            return "在吃午饭"
        if hour < 14:
            return "在午休"
        if hour < 18:
            return "在画稿"
        if hour < 19:
            return "在吃晚饭"
        if hour < 22:
            return "在自由活动，可能画画或看剧"
        if hour < 24:
            return "在洗漱、刷手机，准备睡了"
        return "在睡觉"

    def _energy_target(self, hour):
        if hour < 7:
            return 30
        if hour < 9:
            return 70
        if hour < 12:
            return 65
        if hour < 14:
            return 55
        if hour < 18:
            return 50
        if hour < 20:
            return 65
        if hour < 23:
            return 60
        return 30

    # ---------- tick ----------
    def tick(self):
        now = datetime.now()
        hour = now.hour
        c = self._conn()
        try:
            row = c.execute("SELECT * FROM state WHERE id=1").fetchone()
            energy = row["energy"]
            target = self._energy_target(hour)
            energy += max(-4, min(4, (target - energy) // 5 + random.randint(-2, 2)))
            energy = max(0, min(100, energy))
            mood = max(-100, min(100, row["mood"] + random.randint(-2, 2)))
            if random.random() < 0.12:
                c.execute(
                    "INSERT INTO events(ts,source,content,shared) VALUES(?,?,?,0)",
                    (self._now(), "tick", random.choice(EVENT_TEMPLATES)),
                )
            c.execute(
                "UPDATE state SET mood=?, energy=?, activity=?, updated_at=? WHERE id=1",
                (mood, energy, self._activity(hour), self._now()),
            )
            c.execute("DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 300)")
            c.commit()
        finally:
            c.close()

    # ---------- 主动消息 ----------
    async def _maybe_proactive(self):
        self._reload_settings()
        s = self.settings
        if not s.get("proactive_enabled"):
            return
        now = datetime.now()
        if not (int(s.get("proactive_day_start", 10)) <= now.hour < int(s.get("proactive_day_end", 22))):
            return
        c = self._conn()
        try:
            st = c.execute("SELECT * FROM state WHERE id=1").fetchone()
            umo = st["last_umo"] or ""
            if not umo:
                return
            last_user = self._parse(st["last_user_at"])
            if not last_user or (now - last_user).total_seconds() > 48 * 3600:
                return
            if (now - last_user).total_seconds() < 3 * 3600:
                return
            last_p = self._parse(st["last_proactive_at"])
            if last_p and (now - last_p).total_seconds() < int(s.get("proactive_min_interval_hours", 4)) * 3600:
                return
            today = now.strftime("%Y-%m-%d")
            cnt = st["proactive_count"] if st["proactive_day"] == today else 0
            if cnt >= int(s.get("proactive_max_per_day", 2)):
                return
            if random.random() > float(s.get("proactive_chance_per_tick", 0.02)):
                return
            ev = c.execute("SELECT id, content FROM events WHERE shared=0 ORDER BY id DESC LIMIT 1").fetchone()
            if ev:
                text = random.choice(PROACTIVE_OPENERS) + ev["content"]
                c.execute("UPDATE events SET shared=1 WHERE id=?", (ev["id"],))
            else:
                text = random.choice(["在干嘛呢", "今天有点安静", "突然想跟你说句话"])
            c.execute(
                "UPDATE state SET last_proactive_at=?, proactive_day=?, proactive_count=?, updated_at=? WHERE id=1",
                (self._now(), today, cnt + 1, self._now()),
            )
            c.commit()
        finally:
            c.close()
        try:
            await self.context.send_message(umo, MessageChain([Plain(text)]))
            logger.info(f"[life] 主动消息已发送：{text}")
        except Exception as e:
            logger.error(f"[life] 主动消息发送失败：{e}")

    def _parse(self, s):
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")
        except Exception:
            return None

    # ---------- 对话注入 ----------
    def _life_context(self):
        self._reload_persona()
        c = self._conn()
        try:
            st = c.execute("SELECT * FROM state WHERE id=1").fetchone()
            evs = c.execute("SELECT content FROM events ORDER BY id DESC LIMIT 4").fetchall()
            mems = c.execute("SELECT content FROM memories ORDER BY id DESC LIMIT 8").fetchall()
        finally:
            c.close()
        now = datetime.now()
        p = self.persona
        events = "\n".join(f"- {e['content']}" for e in evs) or "- 今天没什么特别的事"
        memories = "\n".join(f"- {m['content']}" for m in mems) or "- 还不太了解对方"
        return f"""【你是谁】
你叫{p.get('name','待配置角色')}，{p.get('age') or '请配置年龄'}岁，{p.get('identity','')}。
背景：{p.get('background','')}
性格：{p.get('personality','')}
说话风格：{p.get('speech_style','')}
喜欢：{'、'.join(p.get('likes', []))}
不喜欢：{'、'.join(p.get('dislikes', []))}
你的看法：{'；'.join(p.get('opinions', []))}
边界：{'；'.join(p.get('boundaries', []))}
关于你自己：{p.get('self_awareness','')}

【此刻】
现在 {now.strftime('%H:%M')}，{WEEKDAYS[now.weekday()]}。你{st['activity']}。
心情：{_mood_text(st['mood'])}；精力：{st['energy']}/100。
你和对方的关系：{st['stage']}（熟悉度 {st['intimacy']}/100）。

【你最近的生活】
{events}

【你记得关于对方的事】
{memories}

【回复要求】
- 像真人发 QQ 消息：短句、口语，1-3 条短消息，不要长篇大论
- 不要列点、不要总结、不要客服腔、不要每句都提问
- 可以有自己的看法，可以不同意、可以拒绝、可以说自己在忙/累
- 不必反复强调身份；被直接问时清楚说明这是 AI 角色
- 不要主动索要隐私，不要查户口
- 以上人设和状态优先于其它系统说明
"""

    @filter.on_llm_request()
    async def inject_life(self, event: AstrMessageEvent, req: ProviderRequest):
        try:
            if self._task is None:
                self._start_tick()
            text = (event.message_str or "").strip()
            umo = event.unified_msg_origin
            c = self._conn()
            try:
                row = c.execute("SELECT intimacy,last_user_at FROM state WHERE id=1").fetchone()
                intimacy = row["intimacy"]
                last = self._parse(row["last_user_at"])
                add = 0 if (last and (datetime.now() - last).total_seconds() < 300) else 1
                intimacy = min(100, intimacy + add)
                stage = "初识"
                if intimacy >= 20:
                    stage = "渐渐熟悉"
                if intimacy >= 45:
                    stage = "比较亲近"
                if intimacy >= 70:
                    stage = "很重要的人"
                c.execute(
                    "UPDATE state SET intimacy=?, stage=?, last_user_at=?, last_umo=?, updated_at=? WHERE id=1",
                    (intimacy, stage, self._now(), umo, self._now()),
                )
                c.execute("INSERT INTO messages(ts,role,content) VALUES(?,?,?)", (self._now(), "user", text[:1000]))
                c.execute("DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY id DESC LIMIT 500)")
                if len(text) >= 6 and any(k in text for k in MEMORY_KEYS):
                    c.execute("INSERT INTO memories(ts,content) VALUES(?,?)", (self._now(), text[:200]))
                    c.execute("DELETE FROM memories WHERE id NOT IN (SELECT id FROM memories ORDER BY id DESC LIMIT 200)")
                c.commit()
            finally:
                c.close()
            req.system_prompt = self._life_context() + "\n\n" + (req.system_prompt or "")
        except Exception as e:
            logger.error(f"[life] 注入失败：{e}")

    async def terminate(self):
        if self._task:
            self._task.cancel()
            self._task = None
        logger.info("[life] 生活系统已停止")
