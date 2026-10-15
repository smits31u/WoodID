#!/bin/sh
# One-time install of the woodid unit and health-check timer. Run with sudo.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
cp /etc/systemd/system/woodid.service /etc/systemd/system/woodid.service.bak-npm-dev
install -m 644 "$HERE/woodid.service" /etc/systemd/system/woodid.service
install -m 755 "$HERE/woodid-healthcheck.sh" /usr/local/bin/woodid-healthcheck
install -m 644 "$HERE/woodid-healthcheck.service" /etc/systemd/system/woodid-healthcheck.service
install -m 644 "$HERE/woodid-healthcheck.timer" /etc/systemd/system/woodid-healthcheck.timer
systemctl daemon-reload
systemctl restart woodid.service
systemctl enable --now woodid-healthcheck.timer
sleep 4
systemctl --no-pager -l status woodid.service | head -5
curl -fsS --max-time 5 http://127.0.0.1:3000/health && echo
