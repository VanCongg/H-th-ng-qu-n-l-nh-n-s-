# Báo cáo hoàn thiện OmniHR AI Service MVP

## 1. Tổng quan

Đã triển khai lát cắt MVP cho HRGenie Chatbot theo hướng kiến trúc hybrid:

```txt
Flutter Mobile App
  -> OmniHR_BE NestJS
  -> OmniHR_AI FastAPI
  -> Rule-based planner hiện tại, LLM/RAG mở rộng sau
```

Nguyên tắc chính đã giữ đúng:

- Mobile chỉ gọi NestJS, không gọi trực tiếp Python.
- NestJS giữ xác thực, phân quyền, nghiệp vụ, validation, audit log.
- Python AI Service chỉ lập kế hoạch phản hồi/tool call, không ghi database nghiệp vụ.
- Các hành động thay đổi dữ liệu phải đi qua pending action và user xác nhận.

## 2. Backend NestJS đã làm

Đã thêm module:

```txt
OmniHR_BE/src/chatbot
  chatbot.module.ts
  chatbot.controller.ts
  chatbot.service.ts
  chatbot-ai-client.service.ts
  chatbot-history.service.ts
  chatbot-tools.service.ts
  dto/chatbot-message.dto.ts
  dto/chatbot-cancel-action.dto.ts
  types/chatbot.types.ts
```

Các endpoint đã có:

```http
POST /chatbot/message
GET /chatbot/conversations
GET /chatbot/conversations/:id/messages
POST /chatbot/actions/:actionId/confirm
POST /chatbot/actions/:actionId/cancel
```

Các flow chính:

- Lưu conversation và message.
- Gửi message sang Python AI Service qua `X-Internal-Service-Token`.
- Nhận tool plan từ Python.
- Execute tool ở NestJS theo quyền user.
- Tạo pending action cho đơn nghỉ.
- Confirm pending action mới gọi `LeaveRequestsService.create()`.
- Ghi audit log cho pending action, confirm action và tạo đơn nghỉ từ chatbot.

Các tool MVP đã hỗ trợ:

```txt
get_my_profile
get_my_leave_balance
get_my_leave_requests
get_leave_types
create_leave_request_draft
get_today_attendance
get_attendance_policy
get_my_tasks
```

Đã export `LeaveRequestsService` từ `LeaveRequestsModule` để chatbot confirm dùng lại service nghiệp vụ hiện có.

## 3. Database/Prisma đã làm

Đã thêm enum:

```prisma
ChatbotMessageRole
ChatbotActionType
ChatbotActionStatus
```

Đã thêm model:

```prisma
ChatbotConversation
ChatbotMessage
ChatbotPendingAction
```

Đã thêm migration:

```txt
OmniHR_BE/prisma/migrations/20260701160000_chatbot_mvp/migration.sql
```

## 4. Python FastAPI đã làm

Đã thêm service mới:

```txt
OmniHR_AI
  app/main.py
  app/api/health.py
  app/api/chat.py
  app/api/rag.py
  app/core/config.py
  app/core/security.py
  app/schemas/chat.py
  app/schemas/rag.py
  app/services/tool_planner_service.py
  app/services/rag_service.py
  Dockerfile
  requirements.txt
  README.md
  .env.example
```

Endpoint đã có:

```http
GET /health
POST /internal/chat/plan
POST /internal/rag/search
```

AI planner hiện tại là rule-based để demo được ngay, chưa cần API key LLM.

Planner đã nhận diện cơ bản:

- Tạo đơn nghỉ: "mai tôi muốn nghỉ 1 ngày..."
- Xem số ngày phép còn lại.
- Xem trạng thái đơn nghỉ gần nhất.
- Hỏi check-in/chấm công hôm nay.
- Hỏi quy định/giờ chấm công.
- Hỏi hồ sơ/phòng ban/quản lý.
- Hỏi task/công việc/deadline.

## 5. Flutter Mobile đã làm

Đã thêm:

```txt
OmniHR_APP/lib/modules/chat
  chat_screen.dart
  chat_models.dart
  chat_message_bubble.dart
  pending_action_card.dart
```

Đã cập nhật:

```txt
OmniHR_APP/lib/modules/shell/home_shell.dart
```

HRGenie floating action button hiện mở `ChatScreen` thật.

Chat screen hỗ trợ:

- Gửi message tới `/chatbot/message`.
- Giữ `conversationId`.
- Hiển thị message user/assistant.
- Hiển thị loading khi gửi.
- Hiển thị pending action card.
- Confirm pending action.
- Cancel pending action.

## 6. Docker/env đã làm

Đã cập nhật:

```txt
OmniHR_BE/docker-compose.yml
OmniHR_BE/.env.example
OmniHR_BE/.env
```

Các biến môi trường mới:

```env
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_TOKEN=change-me
AI_TIMEOUT_MS=15000
```

Trong Docker compose, backend gọi AI service qua:

```env
AI_SERVICE_URL=http://omnihr-ai:8000
```

## 7. Kiểm tra đã thực hiện

Đã chạy thành công:

```powershell
cd D:\OmniHR\OmniHR_BE
npm run prisma:validate
npm run prisma:generate
npm run build
```

Đã smoke test Python planner:

```txt
"Mai tôi muốn nghỉ 1 ngày vì có việc gia đình"
-> confirmation_required
-> create_leave_request_draft
-> startDate = 2026-07-02
```

Flutter analyze scoped sau cùng chỉ còn một lint nhỏ `unnecessary_underscores`, đã sửa trong:

```txt
OmniHR_APP/lib/modules/chat/chat_screen.dart
```

## 8. Lệnh chạy đề xuất

Chạy bằng Docker cho infra và AI:

```powershell
cd D:\OmniHR\OmniHR_BE
docker compose up -d --build postgres redis omnihr-ai
npm run prisma:deploy
npm run start:dev
```

Chạy mobile:

```powershell
cd D:\OmniHR\OmniHR_APP
flutter run
```

Kiểm tra AI service:

```powershell
curl http://localhost:8000/health
```

## 9. Đề xuất cải tiến tiếp theo

### 9.1. P0 đã bổ sung sau review

Đã bổ sung các việc P0 sau:

```txt
- Thêm rate limit riêng cho POST /chatbot/message: 20 request/phút.
- Thêm trạng thái EXECUTED cho ChatbotActionStatus.
- Sửa confirm flow:
  PENDING -> CONFIRMED -> EXECUTED
  PENDING -> CONFIRMED -> FAILED nếu execution lỗi
  PENDING -> EXPIRED nếu quá hạn trước khi confirm
- Thêm backend unit tests cho ChatbotService và ChatbotToolsService.
- Thêm Python unittest cho ToolPlannerService với 5 câu mẫu.
```

Các test đã chạy thành công:

```powershell
cd D:\OmniHR\OmniHR_BE
npm run prisma:generate
npm run build
npx jest src/chatbot --runInBand
npm run prisma:validate
```

```powershell
cd D:\OmniHR\OmniHR_AI
$env:PYTHONDONTWRITEBYTECODE='1'
python -B -m unittest discover -s app\tests -p "test_tool_planner.py"
```

Kết quả:

```txt
Backend build: passed
Chatbot Jest tests: 2 suites, 5 tests passed
Prisma validate: passed
Python planner tests: 5 tests passed
```

### 9.2. Việc vẫn nên làm tiếp

Các việc nên làm tiếp theo, theo thứ tự ưu tiên:

1. Dọn sạch toàn bộ `flutter analyze` cho app, không chỉ scoped module chat.
2. Chạy end-to-end thật: login mobile, mở HRGenie, tạo nháp nghỉ, confirm, kiểm tra leave request trong DB.
3. Thay rule-based planner bằng LLM provider có JSON schema strict, nhưng vẫn giữ NestJS là tool executor.
4. Thêm `toolResults` endpoint hoặc vòng gọi AI lần hai nếu muốn câu trả lời tự nhiên hơn sau khi NestJS execute tool.
5. Thêm quản trị knowledge base/RAG ở phase sau, không nên gộp vào MVP nếu chưa test xong flow hành động.
6. Giới hạn độ dài history gửi sang Python theo token/character budget.
7. Thêm cơ chế expire pending action định kỳ hoặc xử lý expire khi list conversation.
8. Chuẩn hóa audit action naming nếu reviewer yêu cầu thống nhất toàn hệ thống.

## 10. Trạng thái hiện tại

MVP đã đủ để chạy demo flow chatbot cơ bản:

```txt
User hỏi trên mobile
-> NestJS nhận message
-> Python planner trả tool plan
-> NestJS execute tool/pending action
-> Mobile hiển thị reply/action card
-> User confirm
-> NestJS tạo leave request thật
```

Phần còn thiếu quan trọng nhất không phải code khung, mà là kiểm thử end-to-end với database đang chạy và tài khoản user thật.
