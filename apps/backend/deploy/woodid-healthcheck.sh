#!/bin/sh
# Restarts woodid after two consecutive failed /health checks.
STATE=/run/woodid-healthcheck.fails

if curl -fsS --max-time 5 http://127.0.0.1:3000/health >/dev/null 2>&1; then
    rm -f "$STATE"
    exit 0
fi

FAILS=$(( $(cat "$STATE" 2>/dev/null || echo 0) + 1 ))
echo "$FAILS" > "$STATE"
logger -t woodid-healthcheck "health check failed ($FAILS in a row)"

if [ "$FAILS" -ge 2 ]; then
    rm -f "$STATE"
    logger -t woodid-healthcheck "restarting woodid"
    systemctl restart woodid.service
fi
