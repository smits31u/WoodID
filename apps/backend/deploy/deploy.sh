#!/bin/sh
# Rebuilds the backend and restarts the service. Run from anywhere on coolify.
set -e
cd /home/smits31u/woodid/apps/backend
rm -rf dist
npm run build
sudo systemctl restart woodid.service
sleep 3
curl -fsS --max-time 5 http://127.0.0.1:3000/health && echo
