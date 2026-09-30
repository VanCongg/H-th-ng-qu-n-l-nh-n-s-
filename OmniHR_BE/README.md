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

`prisma/simulate-day.ts` cho công ty "sống tiếp" để tích lũy dữ liệu. Mỗi lần chạy sẽ diễn lại mọi ngày làm việc kể từ lần chạy trước, tính đến hết hôm qua.

**Mọi thao tác đều đi qua chính các service của API**, dưới tài khoản của đúng người làm việc đó: nhân viên chấm công từ app (có GPS, kiểm tra bán kính), xin nghỉ trong app hoặc nhờ HRGenie, trưởng phòng mở dự án và task nhóm, trưởng nhóm chia task con và giao việc (thường bấm "Gợi ý AI" trước), nhân viên bắt đầu làm và gửi duyệt, trưởng nhóm duyệt hoặc trả về. Vì vậy dữ liệu sinh ra giống hệt dữ liệu thao tác tay: cùng kiểm tra quyền, cùng luật nghiệp vụ, có audit log, thông báo, lịch sử gợi ý AI, hội thoại HRGenie, và cache Redis được làm mới đúng cách. Thao tác nào API từ chối thì người ảo cũng bị từ chối; cuối mỗi lần chạy có thống kê số lần bị từ chối theo mã lỗi.

Bộ mô phỏng chỉ giữ phần *quyết định của con người*: ai ốm, ai đi muộn, trưởng nhóm chọn ai, ai làm nhanh hay chậm. Phần này dựa trên "năng lực ẩn" cố định của từng nhân viên (`simulation-persona.ts`). Để các service "tưởng" đang ở ngày quá khứ, đồng hồ được dời tới từng thời điểm mô phỏng (`prisma/simulation/clock.ts`), và `createdAt`/`updatedAt` cũng lấy theo đồng hồ đó (`prisma/simulation/timestamps.ts`).

```bash
# Tạo DB mới chỉ có bộ khung công ty (phòng ban, nhân viên, tài khoản, kỹ năng)
npx prisma migrate reset --force --skip-seed
SEED_ORG_ONLY=true SEED_AS_OF=2026-01-31 npm run prisma:seed

npm run prisma:simulate -- --from 2026-02-02 --max-days 400   # lần đầu: chọn ngày bắt đầu lịch sử
npm run prisma:simulate                                       # các lần sau: chạy bù tới hôm qua
npm run prisma:simulate -- --until 2026-10-02                 # hoặc tới một ngày cụ thể (không vượt quá hôm nay)
```

- Lệnh `prisma:simulate` biên dịch bằng `tsc` (`tsconfig.simulate.json`, ra `dist-simulate/`) rồi chạy bằng `node`, vì dependency injection của NestJS cần metadata decorator mà `tsx` không sinh ra.
- Tin nhắn HRGenie gửi tới `AI_SERVICE_URL`. Đặt `SIMULATION_AI_SERVICE_URL` để trỏ sang một bản AI service rule-based riêng, tránh tốn quota LLM cho vài nghìn câu hỏi mô phỏng.
- Bộ mô phỏng dùng Redis ở `REDIS_HOST` (mặc định `localhost`, chính là Redis của docker compose), nên cache của API đang chạy luôn khớp dữ liệu mới.
- Số giờ thực tế của task do trưởng nhóm ghi khi duyệt xong, vì trên API chỉ trưởng nhóm/trưởng phòng được sửa trường này. Trước lúc đó, số giờ đã làm được bộ mô phỏng giữ riêng.

Tiến độ mô phỏng lưu ở `system_settings` (key `simulation`), nên chạy lại không tạo trùng ngày. `prisma migrate reset` sẽ xóa luôn tiến độ này. Mỗi ngày không nằm trong một transaction chung (mỗi request API tự commit như thật); nếu một lần chạy bị ngắt giữa ngày, hãy khôi phục DB hoặc chạy lại từ đầu.

### Đánh giá gợi ý người nhận task

`prisma/evaluate-suggestions.ts` dựng lại từng lần trưởng nhóm giao task con trong dữ liệu mô phỏng: tình trạng của mỗi ứng viên tại đúng thời điểm giao (task đang ôm, lịch nghỉ đã biết, điểm đánh giá đã chốt), chấm điểm bằng đúng hàm API dùng (`src/ai-task-suggestions/suggestion-scoring.ts`), rồi so với năng lực ẩn của bộ mô phỏng và kết quả thực tế của task. Chỉ đọc dữ liệu; chạy trên một DB mô phỏng riêng, không chạy trên DB thật:

```bash
DATABASE_URL=postgresql://.../omnihr_eval npm run eval:suggestions
```

Báo cáo ghi ra `eval_results/suggestions-eval.md`.

**Giới hạn cần nói rõ khi trích dẫn số liệu.** Trưởng nhóm trong mô phỏng cũng chọn người theo kỹ năng và tải việc — chính những tín hiệu ranking dùng. Nếu chỉ có vậy, điểm cao một phần chỉ có nghĩa là ranking *giống bộ mô phỏng*, không phải *đúng với cách quản lý thật chọn người*. Để giảm tính vòng tròn đó, bộ mô phỏng còn có những yếu tố API không nhìn thấy:

- **Độ "quen tay"** giữa từng trưởng nhóm và từng thành viên (±0,15 điểm, cố định theo cặp, `leadAffinity`);
- **Giao việc để kèm người mới**: 10% số lần trưởng nhóm cố ý giao cho intern/fresher/junior đang ít việc nhất, bất kể kỹ năng;
- **Trưởng nhóm không bao giờ "nghe theo" AI**: họ xin gợi ý, nhưng chỉ chọn trong danh sách khi người họ đã định sẵn có mặt ở đó. Nhờ vậy việc đánh giá so ranking với quyết định của con người, không phải với chính nó;
- 20% số lần chọn ngẫu nhiên, và **năng lực ẩn** (`simulation-persona.ts`) quyết định kết quả task nhưng không bao giờ được trưởng nhóm hay API đọc.

Vì vậy thước đo chính là **năng lực ẩn** và **kết quả thực tế** (đúng hạn, số lần bị trả về) — không phải "trùng với người trưởng nhóm đã chọn". Dù vậy đây vẫn là dữ liệu giả lập: số liệu chứng minh thuật toán bắt được tín hiệu trong kịch bản này, không thay cho đánh giá trên dữ liệu công ty thật. Các yếu tố ẩn chỉ có hiệu lực với những ngày được mô phỏng sau khi thêm vào; muốn cả lịch sử phản ánh chúng, seed lại một DB đánh giá riêng rồi mô phỏng từ đầu.

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
