# INSTRUCTIONS（版本化）

本資料夾存放「每輪任務指令」的**版本化**檔案，避免因檔名尾碼編號而導致其它文件連結失效。

## 使用規則（協作流程用）

- **最新版本**：以本資料夾中 **編號最大的** `BACKEND-INSTRUCTIONS NNN.md` 與 `FRONTEND-INSTRUCTIONS NNN.md` 為準。
- **規格 Agent（執行 agent-collab）更新方式**：
  1. 讀取本資料夾中最新編號 `NNN` 的兩份檔案。
  2. 依協作流程只更新兩份檔案的 **§1**（其餘段落不動）。
  3. 更新完成後，**產生新檔**：將編號改為 `NNN + 1`（例如 `001 → 002`），並將更新後內容寫入新編號檔案。
- **Backend / Frontend Agent**：在各自對話窗中，請 @ `docs/tasks/instructions/` 後，開啟最新編號檔案，只讀 **§1** 進行實作。

## 檔案

- `BACKEND-INSTRUCTIONS NNN.md`
- `FRONTEND-INSTRUCTIONS NNN.md`

