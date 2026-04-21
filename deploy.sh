#!/bin/bash
echo "🚀 Iniciando Deploy..."
NODE_OPTIONS="--max-old-space-size=1024" npm run build
pm2 delete prospector 2>/dev/null || true
pm2 start npm --name "prospector" --node-args="--max-old-space-size=512" -- start
pm2 save
