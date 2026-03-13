#!/usr/bin/env bash
# 開啟兩個 Terminal 視窗，各執行 cloudflared Quick Tunnel，把本機後端／前端暴露成 https://*.trycloudflare.com
# 前置：brew install cloudflared；本機需已跑後端（預設 3003）與前端（預設 5173），或先用 Dev.command 啟動。

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BACKEND_PORT="${POS_TUNNEL_BACKEND_PORT:-3003}"
FRONTEND_PORT="${POS_TUNNEL_FRONTEND_PORT:-5173}"
# 預設開啟 Vercel 正式預覽（VITE_API_BASE_URL 需指向後端 tunnel 或已部署後端）
BROWSER_URL="${POS_TUNNEL_BROWSER_URL:-https://bunnybeans-frontend.vercel.app/}"

if ! command -v cloudflared >/dev/null 2>&1; then
  osascript -e 'display dialog "請先安裝 cloudflared：\n\n  brew install cloudflared\n\n安裝後再雙擊本 App。" buttons {"OK"} default button 1 with title "Cloudflare Tunnel"'
  exit 1
fi

# 兩個獨立 Terminal 視窗（可各自看到 trycloudflare 網址）
osascript <<APPLESCRIPT
tell application "Terminal"
	activate
	set backendCmd to "echo '=== 後端 Tunnel (port ${BACKEND_PORT}) ==='; echo '請將下方 https 網址設為 Vercel 的 VITE_API_BASE_URL（結尾勿加斜線）'; echo ''; cloudflared tunnel --url http://127.0.0.1:${BACKEND_PORT}"
	set frontCmd to "echo '=== 前端 Tunnel (port ${FRONTEND_PORT}) ==='; echo '若未部署 Vercel，可用此網址給遠端看本機前端（須允許混合內容時再調 API）'; echo ''; cloudflared tunnel --url http://127.0.0.1:${FRONTEND_PORT}"
	do script backendCmd
	delay 0.8
	do script frontCmd
end tell
APPLESCRIPT

echo "已開啟兩個 Terminal（cloudflared）。請在視窗內複製 https://xxxx.trycloudflare.com"
echo "約 3 秒後開啟瀏覽器：${BROWSER_URL}"
sleep 3
open "${BROWSER_URL}"
