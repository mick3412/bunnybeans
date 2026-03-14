# 任務指令（docs/tasks）

## 流程

見 **[agent-collab/AGENT-COLLABORATION.md](../agent-collab/AGENT-COLLABORATION.md)**（含三對話分開、**整夾 agent-collab** 說明）。

**Cursor**：`.cursor/rules/agent-task-instructions.mdc`（編輯 INSTRUCTIONS 時提醒讀步驟 2）、`agent-collaboration-spec.mdc`（@ COLLABORATION 時規格流程）。規格 Agent **每輪覆寫**兩檔（不留存上一輪內容亦可）：

| 檔案 | 誰寫入 | 誰讀取 |
|------|--------|--------|
| [BACKEND-INSTRUCTIONS.md](BACKEND-INSTRUCTIONS.md) | 規格 Agent | 後端 Agent（可只丟本檔進對話） |
| [FRONTEND-INSTRUCTIONS.md](FRONTEND-INSTRUCTIONS.md) | 規格 Agent | 前端 Agent |

內容慣例：**P0～P4 表格**、**已交付／不做**、**完成後追加 agent-log**、文末**複製開場白**。

## 規格參考（不必每輪複製進指令）

- [bulk-import-export-plan.md](../bulk-import-export-plan.md) — 批量場景 E1～E5 與 Phase A～D（後端 D＝客戶 CSV 等）

## 單一主題（可選）

若某功能要獨立驗收，可另開 **`TASK-主題-YYYY-MM-DD.md`**；常態仍以上面兩份覆寫檔為主。
