#!/usr/bin/env bash
# Tunnel / 遠端連線診斷：本機服務、DNS、cloudflared、可選單條 Quick Tunnel 測試
# 用法:
#   bash scripts/tunnel-diagnose.sh
#   bash scripts/tunnel-diagnose.sh https://某條.trycloudflare.com   # 測該網址是否可從本機連到 Cloudflare 邊緣

set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "========== POS Tunnel 診斷 =========="
echo "時間: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

echo "--- [1] cloudflared ---"
if command -v cloudflared >/dev/null 2>&1; then
  cloudflared --version 2>&1 | head -1
else
  echo "FAIL: 未安裝 cloudflared → brew install cloudflared"
fi
echo ""

echo "--- [2] DNS：trycloudflare.com 能否解析（根網域）---"
if command -v dig >/dev/null 2>&1; then
  dig +short trycloudflare.com A | head -3
  echo "（若上面空行多，換 nslookup 試）"
elif command -v nslookup >/dev/null 2>&1; then
  nslookup trycloudflare.com 2>/dev/null | tail -5
else
  echo "無 dig/nslookup，略過"
fi
echo ""

echo "--- [3] 本機後端 :3003 ---"
if curl -sf --connect-timeout 2 http://127.0.0.1:3003/health >/dev/null; then
  echo "OK  http://127.0.0.1:3003/health"
  curl -s http://127.0.0.1:3003/health | head -c 200
  echo ""
else
  echo "FAIL 請先起後端: pnpm --filter pos-erp-backend dev"
fi
echo ""

echo "--- [4] 本機前端 :5173（须 Vite 已跑）---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:5173/ 2>/dev/null)
if [[ "$CODE" == "200" ]] || [[ "$CODE" == "304" ]]; then
  echo "OK  HTTP $CODE  http://127.0.0.1:5173/"
else
  echo "FAIL  HTTP ${CODE:-無法連線} — 請起前端: pnpm --filter pos-erp-frontend dev"
fi
echo ""

echo "--- [5] 佔用 3003 / 5173 的 process（若有）---"
for p in 3003 5173; do
  echo "port $p:"
  lsof -i ":$p" 2>/dev/null | head -5 || echo "  (無)"
done
echo ""

if [[ -n "${1:-}" ]]; then
  URL="$1"
  echo "--- [6] 你提供的 Tunnel URL（本機對 Cloudflare 邊緣）---"
  echo "GET $URL"
  curl -sI --connect-timeout 15 --max-time 20 "$URL" 2>&1 | head -15
  echo ""
  HOST=$(echo "$URL" | sed -n 's|https\?://\([^/]*\).*|\1|p')
  if [[ -n "$HOST" ]]; then
    echo "DNS 子網域 $HOST :"
    dig +short "$HOST" 2>/dev/null || nslookup "$HOST" 2>/dev/null | tail -6
    echo "（NXDOMAIN = Tunnel 已關或網址已過期，請重跑 cloudflared 拿新網址）"
  fi
  echo ""
fi

echo "--- [7] 建議下一步 ---"
echo "A) 本機 3、4 都 OK 後，**另開一個 Terminal** 手動跑（看即時 log）："
echo "   cloudflared tunnel --url http://127.0.0.1:3003"
echo "   出現 https://....trycloudflare.com 後，本機執行:"
echo "   bash scripts/tunnel-diagnose.sh 'https://那條網址'"
echo "B) 若 [6] 仍 NXDOMAIN / 連不上：換網路（手機熱點）或 DNS 改 1.1.1.1"
echo "C) 替代：ngrok http 3003 ／ Vercel 前端 + 只 Tunnel 後端（見 docs/tunnel-troubleshooting.md）"
echo "========================================"
