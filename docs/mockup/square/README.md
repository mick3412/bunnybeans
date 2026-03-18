# Square POS 風格示範

本資料夾為**同一 mockup 結構**套用 **Square POS 產品風格**後的視覺變體，方便與根目錄的附圖五色版對照。

## 視覺差異摘要

| 項目 | 預設（附圖五色） | Square 風格 |
|------|------------------|-------------|
| 主背景 | Porcelain #F7F7F2 | 淺灰 #F5F5F5 |
| 側欄 | 深色 Carbon Black #222725 | 白底、深色文字、藍色選中 |
| 主按鈕／連結 | Bright Teal Blue #197BBD | Square 藍 #006AFF |
| 成功狀態 | Jungle Green #0DAB76 | 綠 #28A745 |
| 卡片 | 白底、淡邊 | 白底、淡灰邊、輕陰影 |
| 整體氛圍 | 沉穩、五色分明 | 明亮、簡潔、偏 Square 產品感 |

## 如何開啟

```bash
open docs/mockup/square/index.html
# 或 open docs/mockup/square/pos.html
```

側欄有「預設風格」可回到根目錄的 mockup。本資料夾僅保留總覽與收銀兩頁示範，其餘頁面結構與根目錄相同，可自行複製並加上 `mockup-square.css` 比對。

## 技術說明

- 各頁同時載入 `../mockup.css` 與 `../mockup-square.css`（Square 覆寫在後）。
- 覆寫內容見 [../mockup-square.css](../mockup-square.css)。
