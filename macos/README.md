# POS E2E 一鍵（macOS）

## 現在跑這個是在幹嘛？

| 步驟 | 做什麼 |
|------|--------|
| 1 | 檢查 **http://localhost:3003/health**；若沒回應 → 在背景啟動 **後端**（約需 DB 已建好並可連線）。 |
| 2 | 必要時裝 **Playwright Chromium**。 |
| 3 | 自動起 **Vite**，跑 **登入 → 收銀 → 結帳 → 訂單列表** 等 E2E。 |

等於用機器人幫你驗證「前後端串得起來、結帳流程沒壞」。

## 用 .app 一鍵

1. 在 Finder 打開 **`macos/POS-E2E.app`**，雙擊（第一次可能要在「隱私與安全性」允許）。
2. 會開 **終端機** 視窗跑腳本；跑完按鍵關閉。

**前提**：專案根已有可連線的 **PostgreSQL** 與 **`DATABASE_URL`**（寫在根目錄 `.env` 或 `backend/.env`）。若從未建表，請先在終端執行過：

```bash
pnpm --filter pos-erp-backend prisma:db:push
pnpm --filter pos-erp-backend db:seed
```

## App 放別台電腦 / 搬了專案路徑

`POS-E2E.app` 是依「**App 在倉庫的 `macos/` 底下**」算出倉庫根目錄。請整包複製 repo，不要只複製 `.app` 到沒有專案的地方。

若你一定要把 App 放到桌面：請用 **Automator → 新增應用程式 → 執行 Shell 指令**，內容改成你的絕對路徑，例如：

```bash
cd /你的路徑/POS && bash scripts/e2e-one-click.sh
```

## 純指令（與 .app 相同效果）

```bash
bash scripts/e2e-one-click.sh
```
