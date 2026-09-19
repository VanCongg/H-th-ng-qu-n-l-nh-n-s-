# OmniHR Backend

NestJS + Prisma backend for CoreHR phase 1.

## Quick Start

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed
npm run start:dev
```

Swagger runs at:

```txt
http://localhost:3000/docs
```

## Docker

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npx prisma migrate deploy
docker compose exec api npm run prisma:seed
```

## Dữ liệu mẫu (seed)

`prisma/seed.ts` chỉ chạy trên DB rỗng. Để xóa sạch và tạo lại toàn bộ dữ liệu:

```bash
npx prisma migrate reset --force   # xóa DB, chạy lại migration, rồi chạy seed
```

Bộ dữ liệu mô phỏng một công ty 80 nhân viên, tuân thủ đúng các quy tắc của API:

- 5 phòng ban (CNTT, Nhân sự, Tài chính - Kế toán, Kinh doanh, Hành chính - Vận hành), mỗi phòng đúng một trưởng phòng; 13 nhóm, mỗi nhóm một trưởng nhóm.
- Phòng CNTT 51 người, chia 7 nhóm rõ mảng: Web, Mobile, Backend, Kiểm thử (QA), DevOps & Hạ tầng, Sản phẩm & Thiết kế, Dữ liệu & AI. Dự án CNTT gắn nhãn `[Web]`, `[Mobile]`, `[AI]`, `[DevOps]`, `[Backend]` theo nhóm chủ trì.
- Chức danh "Trưởng …" luôn có role `MANAGER`; Tài chính - Kế toán và nhóm C&B có thêm role `ACCOUNTANT`.
- Quản lý trực tiếp: thành viên → trưởng nhóm → trưởng phòng.
- Dự án do trưởng phòng sở hữu và quản lý; task 2 cấp (task nhóm → task con), người nhận task con thuộc đúng nhóm, trạng thái task nhóm suy ra từ task con.
- Chấm công 22 ngày làm việc gần nhất (không tạo bản ghi hôm nay), đơn nghỉ phép ở mọi trạng thái, kỳ đánh giá đã chốt và kỳ đang mở.
- Có sẵn trường hợp biên: một nhân viên đã nghỉ việc (`toanpv`), một thực tập sinh mới vào, task quá hạn, task chưa giao để thử gợi ý AI.

Mọi ngày tháng tính tương đối theo ngày chạy seed. Tất cả tài khoản dùng mật khẩu `DEFAULT_ADMIN_PASSWORD`; tài khoản admin lấy từ `DEFAULT_ADMIN_USERNAME`.

| Tài khoản | Người dùng | Role |
|---|---|---|
| `DEFAULT_ADMIN_USERNAME` | Quản trị hệ thống | ADMIN |
| `minhnh` | Nguyễn Hoàng Minh — Trưởng phòng CNTT | EMPLOYEE, MANAGER |
| `tuanva` | Vũ Anh Tuấn — Trưởng nhóm Backend | EMPLOYEE, MANAGER |
| `ngoclb` | Lê Bảo Ngọc — Lập trình viên Backend | EMPLOYEE |
| `hangvt` | Vũ Thanh Hằng — Trưởng phòng Nhân sự | EMPLOYEE, MANAGER |
| `yenlh` | Lê Hoàng Yến — Trưởng nhóm C&B | EMPLOYEE, MANAGER, ACCOUNTANT |
| `lantt` | Trương Thị Lan — Kế toán trưởng | EMPLOYEE, MANAGER, ACCOUNTANT |
| `thanhdc` | Đoàn Chí Thành — Trưởng phòng Kinh doanh | EMPLOYEE, MANAGER |
| `hungtv` | Trương Văn Hùng — Trưởng phòng Hành chính - Vận hành | EMPLOYEE, MANAGER |

### Mô phỏng hoạt động hằng ngày

Sau khi seed, `prisma/simulate-day.ts` cho công ty "sống tiếp" để tích lũy dữ liệu cho AI. Mỗi lần chạy sẽ diễn lại mọi ngày làm việc kể từ lần chạy trước, tính đến hết hôm qua:

```bash
npm run prisma:simulate                          # chạy bù tới hôm qua
npm run prisma:simulate -- --until 2026-10-02    # hoặc tới một ngày cụ thể
```

- Mỗi ngày có một dự án mới hoặc một task nhóm lớn, thêm task cho các nhóm sắp hết việc và vài việc phát sinh nhỏ. Task mới chỉ gắn vào dự án mà nhóm đó đang tham gia. Trưởng nhóm giao task con, nhân viên log giờ, gửi duyệt, bị trả về sửa, xong đúng hạn hoặc trễ hạn; task quá hạn lâu của người yếu có thể bị chuyển giao.
- Mỗi nhân viên có "năng lực ẩn" cố định, nên người giỏi luôn làm nhanh và ít phải sửa, người yếu hay trễ hạn và đi muộn.
- Chấm công ra vào hằng ngày; có người nghỉ ốm, xin nghỉ phép rồi được duyệt, bị từ chối hoặc tự hủy.
- Kỳ đánh giá theo quý tự mở và tự chốt, điểm tính từ dữ liệu task và chấm công thật trong quý. Đây chính là tín hiệu hiệu suất mà gợi ý người nhận task bằng AI sử dụng.

Tiến độ mô phỏng lưu ở `system_settings` (key `simulation`), nên chạy lại không tạo trùng ngày. `prisma migrate reset` sẽ xóa luôn tiến độ này.

### Đánh giá gợi ý người nhận task

`prisma/evaluate-suggestions.ts` dựng lại từng lần trưởng nhóm giao task con trong dữ liệu mô phỏng: tình trạng của mỗi ứng viên tại đúng thời điểm giao (task đang ôm, lịch nghỉ đã biết, điểm đánh giá đã chốt), chấm điểm bằng đúng hàm API dùng (`src/ai-task-suggestions/suggestion-scoring.ts`), rồi so với năng lực ẩn của bộ mô phỏng và kết quả thực tế của task. Chỉ đọc dữ liệu; chạy trên một DB mô phỏng riêng, không chạy trên DB thật:

```bash
DATABASE_URL=postgresql://.../omnihr_eval npm run eval:suggestions
```

Báo cáo ghi ra `eval_results/suggestions-eval.md`.

`prisma/seed-ai-large.ts` là bộ dữ liệu cũ dùng cấu trúc khác, không tương thích với seed này — đừng chạy nó sau khi reset.

Run the backend with Docker Compose from this folder, not by clicking Run on
the `omnihr_be-api` image in Docker Desktop. A standalone image container does
not receive the required environment variables and will fail with:

```txt
Config validation error: "DATABASE_URL" is required
```

The compose service injects the correct internal database URL:

```txt
postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
```

For local `npm run start:dev`, keep `.env` using `localhost` in `DATABASE_URL`.
For Docker Compose, the API container uses the `postgres` service host
automatically.

Default admin is read from:

```txt
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
```

## HRGenie Chatbot

The mobile app must call NestJS only. NestJS calls the internal AI service,
validates tools, executes business logic, creates pending actions, and writes
audit logs.

Chatbot endpoints:

```txt
POST /chatbot/message
GET /chatbot/conversations
GET /chatbot/conversations/:id/messages
POST /chatbot/actions/:actionId/confirm
POST /chatbot/actions/:actionId/cancel
```

Important env vars:

```env
AI_SERVICE_URL=http://localhost:8000
DOCKER_AI_SERVICE_URL=http://omnihr-ai:8000
AI_INTERNAL_TOKEN=change-me
AI_TIMEOUT_MS=30000
CHATBOT_RATE_LIMIT_TTL_SECONDS=60
CHATBOT_RATE_LIMIT_MAX=20
CHATBOT_HISTORY_LIMIT=12
CHATBOT_MAX_MESSAGE_LENGTH=1000
CHATBOT_PENDING_ACTION_TTL_MINUTES=30
```

Run backend checks:

```bash
npm run prisma:validate
npm run prisma:generate
npm run build
npm run test
```

For Docker:

```bash
docker compose up -d --build api omnihr-ai
docker compose exec api npm run prisma:deploy
```
