## 環境與指令（集中放這裡）

這一頁只放「必要時才需要」的資訊，避免干擾主流程。

### 重新產生手冊（Markdown + PDF）

```bash
pnpm manual:build
```

輸出：

- `docs/manual/`（Markdown）
- `docs/manual/dist/manual.pdf`（PDF）

### 常見環境變數（給導入人員/IT，超管通常不需要）

- `VITE_API_BASE_URL`：前端打到後端 API 的 base URL
- `ADMIN_API_KEY`（後端）/ `VITE_ADMIN_API_KEY`（前端）：受保護寫入 API 的 Key（**勿放進 git**）

