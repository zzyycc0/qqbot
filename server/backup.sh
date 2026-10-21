#!/bin/bash
# QQ 陪伴：完整备份（配置 + 数据 + 服务单元），保留最近 7 份
set -e
mkdir -p /root/backups
TS=$(date +%Y%m%d-%H%M%S)
OUT=/root/backups/qqb-$TS.tar.gz
tar czf "$OUT" \
  --exclude='AstrBot-master/data/logs' \
  --exclude='AstrBot-master/data/temp' \
  /opt/qqb/AstrBot-master/data \
  /opt/qqb/data \
  /opt/qqb/gateway \
  /opt/qqb/scripts \
  /root/Napcat/opt/QQ/resources/app/app_launcher/napcat/config \
  /root/.config/QQ \
  /root/.qqb-napcat-mode \
  /etc/systemd/system/qqb-napcat.service \
  /etc/systemd/system/qqb-astrbot.service \
  /etc/systemd/system/qqb-gateway.service 2>/dev/null || true
sha256sum "$OUT" > "$OUT.sha256"
ls -t /root/backups/qqb-*.tar.gz 2>/dev/null | tail -n +8 | xargs -r rm -f
echo "$OUT"
