## 促銷規則排序（reorder/bulk）手測清單

> 本清單用於驗收 `PATCH /promotion-rules/reorder/bulk` 的「上移/下移」UI，適合在後端/DB 可用時操作。

### 前置條件
- 後端可連線（`VITE_API_BASE_URL` 正確）
- 若後端有 Admin key guard：設定 `VITE_ADMIN_API_KEY`
- 促銷規則列表至少有 3 筆（方便觀察排序）

### 步驟
1. 進入 `/admin/promotions`
2. 任選一筆規則，點「上移」一次
3. 觀察：
   - UI 立即更新順序（optimistic）
   - 右側顯示 `排序中…`（sorting）
   - 成功後 toast 顯示「已更新排序」
4. 重新整理頁面
5. 確認排序仍保持（後端排序已落盤）
6. 斷線/後端回錯時（可用 dev tools 模擬）：
   - toast 顯示錯誤訊息
   - UI 會回滾到原本排序

