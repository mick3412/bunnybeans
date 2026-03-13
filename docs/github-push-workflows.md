# 將 GitHub Actions 推上遠端

若 `git push` 出現：

`refusing to allow a Personal Access Token ... without workflow scope`

代表目前 HTTPS 用的 **PAT 沒有勾選 `workflow`**。

## 作法（擇一）

1. **GitHub → Settings → Developer settings → Personal access tokens**  
   新建或編輯 token，勾選 **`workflow`**，更新 Cursor／本機 Git 的密碼或 remote URL 使用新 token。  
   然後在本機執行：
   ```bash
   git push origin main
   ```

2. **SSH**  
   若 `origin` 改為 `git@github.com:USER/REPO.git` 且用 SSH key 認證，通常可直接推送 workflow（依帳號權限）。

3. **網頁手動**  
   在 repo 上 **Add file → Create new file** 路徑 `.github/workflows/backend-ci.yml`，貼上本機檔案內容；同樣新增 `e2e.yml`。  
   完成後本機可 `git pull` 與遠端對齊，或 `git reset --hard origin/main` 放棄本地 workflow commit（慎用）。

目前 **main 已推送** 的內容不含上述兩個 workflow；本地尚有一個 commit `ci: GitHub Actions...` 待你補權限後再 push。
