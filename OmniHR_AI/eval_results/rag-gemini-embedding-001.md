# Đánh giá truy xuất chính sách (RAG)

- Bộ câu: dev 16 câu, test 16 câu (mỗi bộ có câu không có trong tài liệu)
- Top-k: 3; ngưỡng chỉ được chọn trên dev, test chấm một lần

| Cấu hình | Recall@3 | Top-1 | Trả lời bừa (câu lạc đề có kết quả) |
|---|---|---|---|
| Chỉ từ khóa — dev | 17% | 17% | 0% (0/4) |
| Chỉ từ khóa — test | 17% | 17% | 0% (0/4) |
| Lai, ngưỡng hiện tại 0.55/0.1 — dev | 58% | 58% | 0% (0/4) |
| Lai, ngưỡng hiện tại 0.55/0.1 — test | 42% | 42% | 0% (0/4) |
| Lai, ngưỡng chọn trên dev 0.73/0.04 — dev | 92% | 92% | 0% (0/4) |
| Lai, ngưỡng chọn trên dev 0.73/0.04 — test | 67% | 67% | 0% (0/4) |

Ngưỡng chọn: RAG_MIN_EMBEDDING_SCORE=0.73, RAG_MIN_EMBEDDING_GAP=0.04 (model `gemini-embedding-001`). Hàm mục tiêu: Recall@3 − tỉ lệ trả lời bừa; hoà thì chọn ngưỡng chặt hơn.

## Câu sai trên test

- "muốn nghỉ thì phải báo trước mấy hôm": không có kết quả
- "chấm công ở quán cà phê gần công ty có được không": không có kết quả
- "nghỉ mà không hưởng lương có được không": không có kết quả
- "tôi có được nhận làm thêm cho công ty đối thủ không": không có kết quả
