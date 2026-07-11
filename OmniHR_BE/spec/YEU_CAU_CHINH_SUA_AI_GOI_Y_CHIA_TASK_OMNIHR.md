# YÊU CẦU CHỈNH SỬA MODULE AI GỢI Ý CHIA TASK - OMNIHR

Ngày tạo: 19/06/2026  
Phạm vi chính: `OmniHR_BE`  
Module chính: `ai-task-suggestions`, `task-workload`, `tasks`, `employee-skills`, `leave-requests`  
Mục tiêu: nâng cấp module AI gợi ý chia task để logic chặt chẽ hơn, dễ bảo vệ đồ án hơn, giảm lỗi nghiệp vụ và minh bạch lý do gợi ý.

---

## 0. Bối cảnh hiện tại

Module hiện tại là **rule-based AI-assisted task recommendation**, không phải ML/LLM. Hệ thống đang:

1. Lấy task cần giao.
2. Lấy required skills của task.
3. Lấy candidate theo quyền Admin/Manager.
4. Lọc candidate theo team nếu task có `teamId`.
5. Tính `skillScore`.
6. Tính `workloadScore`.
7. Nếu `includeAvailability = true`, tính `availabilityScore` dựa trên đơn nghỉ đã duyệt.
8. Tính `finalScore`.
9. Lưu vào `ai_task_suggestions` và `ai_task_suggestion_items`.
10. Manager/Admin chọn một item để assign task.
11. Ghi `task_assignments` và audit log.

Hiện tại cần cải thiện các điểm sau:

- Availability đang tính quá đơn giản: có nghỉ overlap thì 40, không có thì 100.
- Chỉ xét đơn nghỉ `APPROVED`, chưa cảnh báo đơn `PENDING`.
- Manager/requester có thể bị đưa vào candidate nếu thuộc scope.
- `performanceScore` đang tồn tại nhưng chưa có nguồn dữ liệu đủ chắc để dùng trong công thức.
- Suggestion cũ có thể bị chọn sau khi task đã thay đổi hoặc đã quá hạn.
- Reason còn chung chung, chưa đủ mạnh để demo/bảo vệ.
- Task không có required skills vẫn generate được nhưng chưa cảnh báo rõ độ tin cậy thấp.

---

## 1. Nguyên tắc chỉnh sửa bắt buộc

### 1.1 Không biến module này thành ML/LLM

Không thêm OpenAI API, Claude API, model ngoài hoặc ML pipeline trong lần chỉnh này.

Tên kỹ thuật nên giữ là:

```txt
rule-based-v1
```

Nếu cần tăng version do thay đổi công thức, đổi thành:

```txt
rule-based-v2
```

Khuyến nghị: đổi sang `rule-based-v2` vì có thay đổi availability, candidate filtering, snapshot và expire rule.

### 1.2 AI chỉ gợi ý, không tự quyết định

Không tự động assign task khi generate suggestion. Luồng bắt buộc:

```txt
Generate suggestion -> Manager/Admin xem -> Select item -> Assign task
```

### 1.3 Không bỏ qua RBAC/ABAC

Tất cả logic generate/select vẫn phải đi qua `AccessControlService`.

Admin:

- Có thể generate/select trong phạm vi toàn hệ thống.
- Nếu task có team, candidate vẫn phải thuộc team.

Manager:

- Chỉ generate/select trong phạm vi được quản lý.
- Nếu task có team, candidate vẫn phải thuộc team.

Employee:

- Không được generate suggestion.
- Không được select suggestion.
- Không được assign task cho người khác.

---

## 2. Các thay đổi bắt buộc cần code

## 2.1 Nâng cấp DTO tạo gợi ý

File liên quan:

```txt
OmniHR_BE/src/ai-task-suggestions/dto/generate-ai-task-suggestion.dto.ts
```

Bổ sung field:

```ts
includeSelf?: boolean;
includePendingLeave?: boolean;
```

Quy tắc validate/default:

```txt
limit:
- optional
- number
- min = 1
- max = 20
- default = 5

includeAvailability:
- optional
- boolean
- default = true

includeSelf:
- optional
- boolean
- default = false

includePendingLeave:
- optional
- boolean
- default = true
- chỉ có tác dụng khi includeAvailability = true
```

Ý nghĩa:

- `includeSelf = false`: không đưa chính người đang generate vào danh sách candidate nếu người đó có employee profile.
- `includeSelf = true`: cho phép người generate xuất hiện trong danh sách nếu vẫn thỏa ABAC/team scope.
- `includePendingLeave = true`: tính đơn nghỉ `PENDING` như một rủi ro nhẹ trong availability score.

---

## 2.2 Cải thiện candidate filtering

File chính:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
```

Sau khi lấy candidate từ:

```ts
accessControl.candidateEmployeeIdsForTask(actor)
```

cần lọc thêm:

### 2.2.1 Lọc nhân viên inactive/deleted

Chỉ giữ employee:

```txt
status = ACTIVE
AND deletedAt = null
```

Nếu service hiện đã lọc rồi thì vẫn đảm bảo test không bị thiếu.

### 2.2.2 Lọc requester nếu includeSelf = false

Nếu actor có employee profile và `includeSelf = false`:

```txt
candidate.employeeId !== actor.employeeId
```

Nếu sau khi lọc không còn candidate:

```txt
AI_SUGGESTION_NO_CANDIDATES
```

### 2.2.3 Lọc theo team của task

Nếu task có `teamId`, chỉ giữ:

- Thành viên active của team.
- Team lead nếu lead còn active và thuộc candidate scope.

Không được generate item cho người ngoài team.

Nếu sau khi lọc team không còn candidate:

```txt
AI_SUGGESTION_NO_CANDIDATES
```

---

## 2.3 Cải thiện availabilityScore theo tỷ lệ ngày nghỉ

File chính:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
```

Hiện tại không dùng rule cũ:

```txt
Có leave overlap => 40
Không overlap => 100
```

Thay bằng công thức mới.

### 2.3.1 Điều kiện tính availability

Nếu `includeAvailability = false`:

```txt
availabilityScore = 100
```

Nếu task thiếu `startDate` hoặc `dueDate`:

```txt
availabilityScore = 100
```

Nếu `startDate > dueDate` thì backend không nên đến bước này vì task validation phải chặn trước. Tuy nhiên vẫn nên guard an toàn:

```txt
availabilityScore = 100
```

### 2.3.2 Tính số ngày làm việc của task

Tính số ngày làm việc trong khoảng:

```txt
task.startDate -> task.dueDate
```

Quy tắc MVP:

- Tính inclusive cả startDate và dueDate.
- Bỏ thứ 7 và chủ nhật.
- Chưa cần tính ngày lễ.

Ví dụ:

```txt
Task từ 2026-06-15 đến 2026-06-19 => 5 workdays
Task từ 2026-06-15 đến 2026-06-21 => 5 workdays
```

Nếu `taskWorkDays <= 0`:

```txt
availabilityScore = 100
```

### 2.3.3 Lấy leave requests overlap

Lấy leave requests của từng employee hoặc batch theo candidate nếu tối ưu được.

Chỉ xét leave request có overlap với task range:

```txt
leave.startDate <= task.dueDate
AND leave.endDate >= task.startDate
```

Status được xét:

```txt
APPROVED
PENDING nếu includePendingLeave = true
```

Không xét:

```txt
REJECTED
CANCELLED
```

### 2.3.4 Công thức penalty

Tách riêng approved và pending.

```txt
approvedOverlapWorkDays = số ngày làm việc overlap với leave APPROVED
pendingOverlapWorkDays = số ngày làm việc overlap với leave PENDING
```

Nếu có nhiều đơn overlap cùng ngày, không được đếm trùng ngày. Nên dùng Set theo `yyyy-mm-dd`.

Công thức:

```txt
approvedPenalty = min(60, approvedOverlapWorkDays / taskWorkDays * 60)
pendingPenalty  = min(25, pendingOverlapWorkDays  / taskWorkDays * 25)

availabilityScore = clamp(100 - approvedPenalty - pendingPenalty, 0, 100)
```

Làm tròn 2 chữ số thập phân.

Ý nghĩa:

- Nghỉ đã duyệt ảnh hưởng mạnh, tối đa trừ 60 điểm.
- Nghỉ đang chờ duyệt chỉ là rủi ro, tối đa trừ 25 điểm.

Ví dụ:

```txt
Task 10 workdays, nghỉ APPROVED 1 ngày:
approvedPenalty = 1/10*60 = 6
availabilityScore = 94

Task 5 workdays, nghỉ APPROVED 4 ngày:
approvedPenalty = 4/5*60 = 48
availabilityScore = 52

Task 5 workdays, có PENDING 2 ngày:
pendingPenalty = 2/5*25 = 10
availabilityScore = 90
```

### 2.3.5 Reason phải hiển thị thông tin nghỉ

Nếu có leave overlap, reason phải nói rõ:

```txt
Có lịch nghỉ đã duyệt trùng 2/10 ngày làm việc của task.
Có đơn nghỉ đang chờ duyệt trùng 1/10 ngày làm việc của task.
```

Nếu không có:

```txt
Không có lịch nghỉ trùng thời gian task.
```

---

## 2.4 Chuẩn hóa công thức finalScore

File chính:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
```

Dùng công thức sau cho `rule-based-v2`.

### 2.4.1 Khi includeAvailability = true

```txt
finalScore = skillScore * 0.50
           + workloadScore * 0.35
           + availabilityScore * 0.15
```

### 2.4.2 Khi includeAvailability = false

```txt
finalScore = skillScore * 0.60
           + workloadScore * 0.40
```

Làm tròn 2 chữ số thập phân.

### 2.4.3 Không dùng performanceScore trong lần chỉnh này

Vì hệ thống chưa có nguồn dữ liệu hiệu suất đủ chắc, chưa đưa `performanceScore` vào công thức.

Yêu cầu xử lý:

- Giữ field `performanceScore` để tương thích database/API nếu đã tồn tại.
- Nếu schema cho phép nullable: set `performanceScore = null`.
- Nếu schema đang required/non-null: set `performanceScore = 0` hoặc giá trị hiện tại đang dùng, nhưng thêm comment rõ: `reserved for future performance module`.
- Không hiển thị `performanceScore` như một yếu tố chính trên UI/API documentation nếu chưa dùng trong `finalScore`.
- Không viết reason kiểu “hiệu suất tốt” nếu chưa tính hiệu suất thật.

Không được tạo performance score giả gây hiểu nhầm.

---

## 2.5 Cải thiện skillScore reason

Logic tính `skillScore` hiện tại có thể giữ, nhưng reason cần chi tiết hơn.

Reason nên có các thành phần:

1. Số skill match.
2. Tên skill match mạnh.
3. Tên skill còn thiếu.
4. Workload ngắn gọn.
5. Availability ngắn gọn.
6. Cảnh báo nếu task chưa có required skills.

Ví dụ reason tốt:

```txt
Nguyễn Văn A được xếp hạng #1 vì khớp 3/4 kỹ năng yêu cầu: NestJS, TypeScript, PostgreSQL. Còn thiếu: Testing. Workload hiện tại còn 18h/tuần, có 2 task active. Không có lịch nghỉ trùng thời gian task.
```

Nếu employee thiếu skill required:

```txt
Cần cân nhắc vì thiếu kỹ năng bắt buộc: Docker.
```

Nếu task không có required skills:

```txt
Task chưa khai báo kỹ năng yêu cầu, kết quả gợi ý chủ yếu dựa trên workload và phạm vi quản lý.
```

### 2.5.1 Không để lỗi encoding tiếng Việt

Kiểm tra source/comment/string trong service. Tất cả reason tiếng Việt phải là UTF-8 hợp lệ.

Không để text bị lỗi kiểu:

```txt
phÃ¹ há»£p
kháº£ dá»¥ng
```

---

## 2.6 Thêm taskFingerprint để chống chọn suggestion cũ

Mục tiêu: suggestion đã generate không được chọn nếu task đã thay đổi dữ liệu quan trọng.

File chính:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
```

### 2.6.1 Tạo fingerprint khi generate

Tạo helper:

```ts
buildTaskSuggestionFingerprint(task): string
```

Dữ liệu đưa vào fingerprint phải stable/sorted:

```txt
taskId
teamId
departmentId
projectId
startDate
dueDate
estimatedHours
priority
status
requiredSkills sorted by skillId:
  - skillId
  - requiredProficiency
  - weight
  - isRequired
```

Dùng Node `crypto` SHA-256:

```ts
createHash('sha256').update(JSON.stringify(payload)).digest('hex')
```

Lưu vào `inputSnapshot`:

```json
{
  "algorithmVersion": "rule-based-v2",
  "taskFingerprint": "...",
  "filters": {
    "limit": 5,
    "includeAvailability": true,
    "includeSelf": false,
    "includePendingLeave": true
  },
  "weights": {
    "skill": 0.5,
    "workload": 0.35,
    "availability": 0.15
  },
  "candidateEmployeeIds": [1, 2, 3],
  "requiredSkills": [...]
}
```

### 2.6.2 Kiểm tra fingerprint khi select

Trong `select()`:

1. Load suggestion.
2. Load task hiện tại kèm required skills.
3. Rebuild fingerprint.
4. So sánh với `inputSnapshot.taskFingerprint`.

Nếu khác:

- Update suggestion status thành `EXPIRED`.
- Không assign task.
- Trả lỗi:

```txt
AI_SUGGESTION_EXPIRED
```

Message tiếng Việt/Anh tùy convention hiện tại:

```txt
Gợi ý đã hết hiệu lực vì task đã thay đổi. Vui lòng tạo gợi ý mới.
```

---

## 2.7 Expire suggestion theo thời gian và trạng thái task

### 2.7.1 TTL mặc định

Thêm constant:

```ts
AI_SUGGESTION_TTL_HOURS = 24
```

Nếu suggestion `GENERATED` quá 24 giờ, khi select phải:

- Mark status `EXPIRED`.
- Không assign.
- Trả lỗi `AI_SUGGESTION_EXPIRED`.

Không bắt buộc làm cron job trong lần này. Kiểm tra lazy ở bước select là đủ.

### 2.7.2 Không cho chọn nếu task đã đóng

Nếu task status là:

```txt
DONE
CANCELLED
```

hoặc task đã `deletedAt != null`:

- Mark suggestion `EXPIRED` nếu đang `GENERATED`.
- Không assign.
- Trả lỗi `AI_SUGGESTION_EXPIRED` hoặc `TASK_NOT_ASSIGNABLE` nếu project đang dùng error code này.

### 2.7.3 Không cho chọn nếu task đã có assignee khác sau thời điểm generate

Nếu task hiện đã có `assigneeId` và khác với item được chọn, cần cân nhắc:

- Nếu hệ thống cho phép reassign qua AI: vẫn cho, nhưng phải ghi `assignmentType = REASSIGNED` hoặc note rõ.
- Nếu muốn an toàn MVP: không cho chọn suggestion cũ khi task đã có assignee sau generate.

Chọn hướng an toàn MVP:

```txt
Nếu task.assigneeId != null và task.updatedAt > suggestion.createdAt:
  mark EXPIRED
  throw AI_SUGGESTION_EXPIRED
```

Message:

```txt
Gợi ý đã hết hiệu lực vì task đã được cập nhật hoặc đã có người nhận.
```

---

## 2.8 Thêm API cancel suggestion

File liên quan:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.controller.ts
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
```

Thêm endpoint:

```http
POST /ai-task-suggestions/:id/cancel
```

Permission:

```txt
AI_TASK_SELECT
```

Body:

```json
{
  "reason": "Task đã đổi yêu cầu nên hủy gợi ý cũ."
}
```

DTO mới:

```txt
OmniHR_BE/src/ai-task-suggestions/dto/cancel-ai-task-suggestion.dto.ts
```

Validate:

```txt
reason optional string max 500
```

Rule:

- Chỉ cancel suggestion status `GENERATED`.
- Nếu đã `SELECTED`, không được cancel.
- Nếu đã `EXPIRED` hoặc `CANCELLED`, idempotent hoặc trả lỗi tùy convention hiện tại. Khuyến nghị idempotent: trả về suggestion hiện tại, không lỗi.
- Phải kiểm tra actor có quyền đọc/assign task tương ứng qua `AccessControlService`.
- Ghi audit:

```txt
CANCEL_AI_TASK_SUGGESTION
```

Nếu schema chưa có `cancelReason`, có thể lưu reason vào audit `newValue` trước, chưa cần migration. Nếu muốn đầy đủ hơn, xem mục 2.9.

---

## 2.9 Migration database nếu cần

Không bắt buộc migration nếu có thể lưu đủ vào `inputSnapshot` và status hiện tại.

Nếu muốn làm đầy đủ, thêm các field sau vào `AiTaskSuggestion`:

```prisma
expiresAt        DateTime?
cancelledAt      DateTime?
cancelledByUserId Int?
cancelReason     String? @db.VarChar(500)
```

Khuyến nghị cho lần này:

- Tối thiểu phải lưu `taskFingerprint` trong `inputSnapshot`.
- Có thể chưa thêm field mới để tránh migration không cần thiết.
- Nếu thêm `expiresAt`, set khi generate:

```txt
expiresAt = createdAt + 24h
```

Nếu thêm migration, phải cập nhật:

```txt
prisma/schema.prisma
migration mới
prisma/seed.ts nếu cần
DTO/response type nếu đang expose
```

---

## 2.10 Cải thiện response trả về

Response của generate/detail nên đủ cho UI hiển thị đẹp:

Mỗi item nên có:

```json
{
  "suggestionItemId": 10,
  "employeeId": 5,
  "fullName": "Nguyễn Văn A",
  "employeeCode": "EMP001",
  "departmentName": "Engineering",
  "positionName": "Backend Developer",
  "rank": 1,
  "score": 86.5,
  "skillScore": 92,
  "workloadScore": 78,
  "availabilityScore": 94,
  "performanceScore": null,
  "reason": "...",
  "selected": false,
  "warnings": [
    "Có đơn nghỉ đang chờ duyệt trùng 1 ngày làm việc của task"
  ]
}
```

Nếu database chưa có `warnings`, không cần lưu column riêng. Có thể sinh warnings từ reason hoặc thêm vào response từ service.

Response suggestion nên có:

```json
{
  "suggestionId": 1,
  "taskId": 100,
  "algorithmVersion": "rule-based-v2",
  "status": "GENERATED",
  "expiresAt": "2026-06-20T10:00:00.000Z",
  "inputSnapshot": {...},
  "items": [...]
}
```

Nếu không thêm `expiresAt` column, có thể tính từ `createdAt + 24h` trong response.

---

## 3. Các file dự kiến cần sửa

### 3.1 Bắt buộc

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.controller.ts
OmniHR_BE/src/ai-task-suggestions/dto/generate-ai-task-suggestion.dto.ts
OmniHR_BE/src/ai-task-suggestions/dto/select-ai-task-suggestion.dto.ts
OmniHR_BE/src/ai-task-suggestions/dto/ai-task-suggestion-query.dto.ts
OmniHR_BE/src/common/services/access-control.service.ts
OmniHR_BE/src/common/errors/api-error.ts hoặc nơi khai báo error code hiện tại
OmniHR_BE/prisma/schema.prisma nếu thêm field expires/cancel
```

### 3.2 Có thể cần thêm

```txt
OmniHR_BE/src/ai-task-suggestions/dto/cancel-ai-task-suggestion.dto.ts
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.spec.ts
OmniHR_BE/src/tasks/tasks.service.spec.ts
OmniHR_BE/src/projects/projects.service.spec.ts
OmniHR_BE/src/common/utils/date.utils.ts nếu có helper date chung
```

### 3.3 Nếu web đang type chặt API

```txt
OmniHR_WEB/src/api/types.ts
OmniHR_WEB/src/api/endpoints.ts
OmniHR_WEB/src/features/ai-task-suggestions/*
OmniHR_WEB/src/features/tasks/*
```

Web không phải trọng tâm của lần chỉnh này, nhưng nếu response contract thay đổi thì phải cập nhật type để build không lỗi.

---

## 4. Error codes cần có

Thêm hoặc dùng lại error code theo convention hiện tại.

Nên có tối thiểu:

```txt
AI_SUGGESTION_NO_CANDIDATES
AI_TASK_SUGGESTION_NOT_FOUND
AI_TASK_SUGGESTION_ITEM_NOT_FOUND
AI_SUGGESTION_ALREADY_SELECTED
AI_SUGGESTION_EXPIRED
AI_SUGGESTION_CANCELLED
TASK_NOT_FOUND
TASK_NOT_ASSIGNABLE
VALIDATION_ERROR
```

Message gợi ý:

```txt
AI_SUGGESTION_NO_CANDIDATES:
Không tìm thấy nhân viên phù hợp trong phạm vi có thể phân công.

AI_SUGGESTION_EXPIRED:
Gợi ý đã hết hiệu lực. Vui lòng tạo gợi ý mới.

AI_SUGGESTION_CANCELLED:
Gợi ý đã bị hủy.

TASK_NOT_ASSIGNABLE:
Task hiện không thể phân công vì đã hoàn thành, đã hủy hoặc đã bị xóa.
```

---

## 5. Test bắt buộc

Bổ sung hoặc cập nhật test trong:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.spec.ts
```

### 5.1 Test candidate filtering

1. `includeSelf = false` loại actor employee khỏi candidate.
2. `includeSelf = true` cho phép actor employee nếu thuộc scope.
3. Task có `teamId` thì chỉ gợi ý active member của team.
4. Không có candidate sau khi lọc thì throw `AI_SUGGESTION_NO_CANDIDATES`.
5. Employee inactive/deleted không được đưa vào suggestion.

### 5.2 Test availabilityScore

1. `includeAvailability = false` => availabilityScore = 100.
2. Task không có startDate/dueDate => availabilityScore = 100.
3. Task 10 workdays, approved leave overlap 1 workday => availabilityScore = 94.
4. Task 5 workdays, approved leave overlap 4 workdays => availabilityScore = 52.
5. Task 5 workdays, pending leave overlap 2 workdays, includePendingLeave = true => availabilityScore = 90.
6. Pending leave không bị tính nếu includePendingLeave = false.
7. Overlap cuối tuần không được tính là workday.
8. Nhiều leave trùng cùng ngày không được đếm trùng.

### 5.3 Test finalScore

1. Có availability:

```txt
skillScore = 90
workloadScore = 80
availabilityScore = 94
finalScore = 90*0.5 + 80*0.35 + 94*0.15 = 87.1
```

2. Không có availability:

```txt
skillScore = 90
workloadScore = 80
finalScore = 90*0.6 + 80*0.4 = 86
```

3. Làm tròn 2 chữ số.

### 5.4 Test fingerprint/expire

1. Generate suggestion lưu `taskFingerprint` trong `inputSnapshot`.
2. Select suggestion khi task không đổi => assign thành công.
3. Select suggestion sau khi task required skills đổi => mark `EXPIRED`, không assign.
4. Select suggestion sau 24h => mark `EXPIRED`, không assign.
5. Select suggestion khi task status `DONE` hoặc `CANCELLED` => không assign.
6. Select suggestion đã `SELECTED` => throw `AI_SUGGESTION_ALREADY_SELECTED`.
7. Select suggestion `CANCELLED` => throw `AI_SUGGESTION_CANCELLED` hoặc lỗi phù hợp.

### 5.5 Test cancel API/service

1. Cancel suggestion `GENERATED` thành công.
2. Cancel suggestion `SELECTED` không được phép.
3. Cancel suggestion đã `CANCELLED` trả idempotent hoặc lỗi theo convention đã chọn.
4. Cancel phải ghi audit `CANCEL_AI_TASK_SUGGESTION`.

### 5.6 Test reason

1. Reason có matched skills.
2. Reason có missing required skills nếu thiếu.
3. Reason có workload summary.
4. Reason có approved leave warning.
5. Reason có pending leave warning.
6. Task chưa có required skills thì reason có cảnh báo độ tin cậy thấp.
7. Không có lỗi encoding tiếng Việt.

---

## 6. Acceptance criteria

Chỉ coi là hoàn thành khi đạt đủ các tiêu chí sau:

### 6.1 Backend build/test

Chạy thành công:

```bash
npm run prisma:validate
npm run build
npm run test
```

Nếu có lint script thì chạy thêm:

```bash
npm run lint
```

### 6.2 API behavior

1. `POST /tasks/:taskId/ai-suggestions` nhận được body mới:

```json
{
  "limit": 5,
  "includeAvailability": true,
  "includeSelf": false,
  "includePendingLeave": true
}
```

2. Response trả top N employee đúng scope.
3. Không gợi ý người ngoài team khi task có team.
4. Không gợi ý requester nếu `includeSelf = false`.
5. Availability score phản ánh đúng tỷ lệ ngày nghỉ.
6. Reason dễ hiểu, không lỗi tiếng Việt.
7. Suggestion có `algorithmVersion = rule-based-v2`.
8. `inputSnapshot` có `taskFingerprint`, filters và weights.
9. Select suggestion cũ/task thay đổi thì bị chặn.
10. Cancel suggestion hoạt động.

### 6.3 Không phá luồng cũ

Các API cũ vẫn hoạt động:

```http
POST /tasks/:taskId/ai-suggestions
GET /tasks/:taskId/ai-suggestions
GET /ai-task-suggestions
GET /ai-task-suggestions/:id
POST /ai-task-suggestions/:id/select
```

Nếu frontend chưa gửi `includeSelf` hoặc `includePendingLeave`, backend vẫn dùng default và không lỗi.

### 6.4 Không làm sai bảo mật

1. Employee không generate/select được.
2. Manager không generate/select ngoài scope.
3. Admin vẫn hoạt động toàn hệ thống.
4. Select vẫn kiểm tra lại quyền assign, không tin vào dữ liệu suggestion cũ.
5. Ghi audit đầy đủ cho generate, select, cancel, expired-on-select nếu có.

---

## 7. Gợi ý cấu trúc helper nên tách trong service

Trong `AiTaskSuggestionsService`, nên tách hàm nhỏ để dễ test:

```ts
private normalizeGenerateOptions(dto: GenerateAiTaskSuggestionDto): NormalizedGenerateOptions
private filterCandidatesByOptions(candidateIds: number[], actor: AuthActor, options: NormalizedGenerateOptions): number[]
private filterCandidatesByTaskTeam(candidateIds: number[], task: TaskWithRelations): Promise<number[]>
private calculateSkillScore(requiredSkills, employeeSkills): SkillScoreResult
private calculateWorkloadScore(workloadSummary): number
private calculateAvailabilityScore(employeeId: number, task: TaskWithRelations, options: NormalizedGenerateOptions): Promise<AvailabilityScoreResult>
private countWeekdaysInclusive(start: Date, end: Date): number
private getOverlapWeekdaysSet(rangeA, rangeB): Set<string>
private calculateFinalScore(scores, options): number
private buildSuggestionReason(context): string
private buildTaskSuggestionFingerprint(task: TaskWithRelations): string
private ensureSuggestionSelectable(suggestion, task): Promise<void>
```

Kết quả helper nên trả object, không chỉ number, để reason dễ dùng:

```ts
type AvailabilityScoreResult = {
  score: number;
  approvedOverlapWorkDays: number;
  pendingOverlapWorkDays: number;
  taskWorkDays: number;
  warnings: string[];
};

type SkillScoreResult = {
  score: number;
  matchedSkills: string[];
  missingRequiredSkills: string[];
  missingOptionalSkills: string[];
  hasRequiredSkillData: boolean;
};
```

---

## 8. Những việc không làm trong lần chỉnh này

Không làm các phần sau để tránh phình scope:

```txt
Không tích hợp LLM.
Không làm machine learning.
Không làm chatbot.
Không làm feedback learning.
Không làm calendar/meeting load.
Không tính ngày lễ Việt Nam.
Không làm capacity riêng từng nhân viên nếu database chưa có sẵn.
Không thay đổi toàn bộ kiến trúc RBAC/ABAC.
Không rewrite toàn bộ task module.
```

Có thể ghi TODO cho tương lai, nhưng không kéo vào scope lần này.

---

## 9. Gợi ý nâng cấp sau này, không bắt buộc

Sau khi bản này ổn, có thể làm tiếp:

1. `employee.weeklyCapacityHours` để workload thực tế hơn.
2. `completedAt` cho task để tính performance score thật.
3. Feedback loop:
   - Manager bỏ qua gợi ý vì sao.
   - Task sau khi assign có hoàn thành đúng hạn không.
4. LLM hỗ trợ đọc mô tả task và đề xuất required skills.
5. Dashboard AI suggestion accuracy.
6. Expire suggestion bằng scheduled job.

---

## 10. Câu mô tả dùng cho báo cáo/bảo vệ

Sau khi chỉnh xong, có thể mô tả module như sau:

```txt
Module AI gợi ý chia task trong OmniHR sử dụng rule-based recommendation engine. Hệ thống phân tích độ khớp kỹ năng, tải công việc hiện tại và lịch nghỉ phép của nhân viên để xếp hạng ứng viên phù hợp cho từng task. AI không tự động quyết định mà chỉ đưa ra gợi ý có giải thích; Manager/Admin là người chọn cuối cùng. Mỗi lần gợi ý, lựa chọn và phân công đều được lưu lịch sử và audit log để đảm bảo minh bạch.
```

---

## 11. Checklist để tự kiểm trước khi gửi Claude đánh giá

Claude/Reviewer cần kiểm tra:

- [ ] Yêu cầu có rõ scope không?
- [ ] Có tránh gọi sai là ML/LLM không?
- [ ] Candidate filtering có đúng RBAC/ABAC không?
- [ ] Availability có tính đơn nghỉ `APPROVED` và `PENDING` hợp lý không?
- [ ] Công thức điểm có minh bạch không?
- [ ] `performanceScore` có bị dùng giả không?
- [ ] Suggestion cũ có bị chặn khi task thay đổi/quá hạn không?
- [ ] API cancel có hợp lý không?
- [ ] Có test đủ cho case quan trọng không?
- [ ] Có tránh phình scope không?
- [ ] Có đủ acceptance criteria để Codex code không hiểu sai không?

