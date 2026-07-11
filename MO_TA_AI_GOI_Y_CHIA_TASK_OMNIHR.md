# Mô tả cơ chế AI gợi ý chia task trong OmniHR

Ngày xuất: 19/06/2026  
Phạm vi: backend `OmniHR_BE`  
Module chính: `ai-task-suggestions`, `task-workload`, `tasks`, `employee-skills`

## 1. Kết luận nhanh

Phần "AI gợi ý chia task" hiện tại **không phải machine learning thật** và cũng chưa gọi model bên ngoài. Nó là một engine gợi ý dạng **rule-based AI-assisted recommendation**.

Nói dễ hiểu:

- Hệ thống lấy task cần giao.
- Lấy kỹ năng task yêu cầu.
- Lấy danh sách nhân viên có thể nhận task theo quyền của người dùng.
- Tính điểm kỹ năng của từng nhân viên.
- Tính điểm tải việc của từng nhân viên.
- Có thể tính thêm điểm khả dụng dựa trên lịch nghỉ phép đã duyệt.
- Ghép các điểm lại thành điểm tổng.
- Sắp xếp nhân viên theo điểm tổng.
- Lưu kết quả gợi ý vào database.
- Manager/Admin phải chọn một gợi ý thì task mới được assign.

AI ở đây đóng vai trò **gợi ý**, không tự quyết định cuối cùng.

## 2. File backend liên quan

Các file chính:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.ts
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.controller.ts
OmniHR_BE/src/task-workload/task-workload.service.ts
OmniHR_BE/src/tasks/tasks.service.ts
OmniHR_BE/src/employee-skills/employee-skills.service.ts
OmniHR_BE/src/common/services/access-control.service.ts
OmniHR_BE/prisma/schema.prisma
```

DTO liên quan:

```txt
OmniHR_BE/src/ai-task-suggestions/dto/generate-ai-task-suggestion.dto.ts
OmniHR_BE/src/ai-task-suggestions/dto/select-ai-task-suggestion.dto.ts
OmniHR_BE/src/ai-task-suggestions/dto/ai-task-suggestion-query.dto.ts
```

Test đã thêm:

```txt
OmniHR_BE/src/ai-task-suggestions/ai-task-suggestions.service.spec.ts
OmniHR_BE/src/tasks/tasks.service.spec.ts
OmniHR_BE/src/projects/projects.service.spec.ts
```

## 3. Database dùng cho AI gợi ý

### 3.1 Bảng `tasks`

Lưu task chính:

- `title`
- `description`
- `priority`
- `status`
- `projectId`
- `departmentId`
- `teamId`
- `assigneeId`
- `startDate`
- `dueDate`
- `estimatedHours`
- `actualHours`

AI đọc task để biết:

- Task thuộc team nào.
- Task yêu cầu kỹ năng nào.
- Task có deadline nào.
- Task đang có assignee chưa.

### 3.2 Bảng `task_required_skills`

Lưu kỹ năng task yêu cầu:

- `taskId`
- `skillId`
- `requiredProficiency`
- `weight`
- `isRequired`

Ví dụ task cần:

```txt
NESTJS, requiredProficiency = ADVANCED, weight = 1.2
TYPESCRIPT, requiredProficiency = ADVANCED, weight = 1.0
TESTING, requiredProficiency = INTERMEDIATE, weight = 0.7
```

AI dùng bảng này để tính `skillScore`.

### 3.3 Bảng `employee_skills`

Lưu kỹ năng của nhân viên:

- `employeeId`
- `skillId`
- `yearsExperience`
- `proficiency`
- `lastUsedAt`
- `note`

AI so sánh `employee_skills` với `task_required_skills`.

### 3.4 Bảng `leave_requests`

AI dùng đơn nghỉ đã duyệt để tính availability:

- Chỉ xét đơn có `status = APPROVED`.
- Nếu đơn nghỉ overlap với thời gian task thì `availabilityScore` bị giảm.

### 3.5 Bảng `ai_task_suggestions`

Mỗi lần bấm "AI gợi ý" sẽ tạo một record:

- `taskId`
- `requestedByUserId`
- `algorithmVersion`
- `inputSnapshot`
- `status`
- `createdAt`

`algorithmVersion` hiện là:

```txt
rule-based-v1
```

`inputSnapshot` lưu lại dữ liệu đầu vào quan trọng như:

- Task id.
- Candidate ids.
- Required skills.
- Có tính availability hay không.

### 3.6 Bảng `ai_task_suggestion_items`

Lưu từng nhân viên được gợi ý:

- `suggestionId`
- `employeeId`
- `rank`
- `score`
- `skillScore`
- `workloadScore`
- `availabilityScore`
- `performanceScore`
- `reason`
- `selected`

Đây là bảng phục vụ xem lại lịch sử AI gợi ý.

### 3.7 Bảng `task_assignments`

Khi người dùng chọn một gợi ý AI, backend tạo lịch sử giao task:

- `taskId`
- `assigneeId`
- `assignedByUserId`
- `assignmentType = AI_SUGGESTED`
- `note`
- `assignedAt`

## 4. API hiện có

### 4.1 Tạo gợi ý AI cho task

```http
POST /tasks/:taskId/ai-suggestions
```

Permission:

```txt
AI_TASK_SUGGEST
```

Body:

```json
{
  "limit": 5,
  "includeAvailability": true
}
```

Ý nghĩa:

- `limit`: số ứng viên tối đa trả về, từ 1 đến 20.
- `includeAvailability`: có tính lịch nghỉ phép vào điểm hay không.

### 4.2 Xem gợi ý theo task

```http
GET /tasks/:taskId/ai-suggestions
```

Permission:

```txt
AI_TASK_SUGGEST
AI_TASK_SELECT
TASK_ASSIGNMENT_READ
```

### 4.3 Xem danh sách lịch sử gợi ý

```http
GET /ai-task-suggestions
```

Có thể lọc theo query DTO.

### 4.4 Xem chi tiết một lần gợi ý

```http
GET /ai-task-suggestions/:id
```

### 4.5 Chọn một gợi ý để assign task

```http
POST /ai-task-suggestions/:id/select
```

Permission:

```txt
AI_TASK_SELECT
```

Body:

```json
{
  "suggestionItemId": 123,
  "note": "Chọn theo gợi ý AI vì phù hợp kỹ năng và workload thấp."
}
```

Khi gọi API này, backend sẽ:

- Kiểm tra suggestion tồn tại.
- Kiểm tra suggestion còn trạng thái `GENERATED`.
- Kiểm tra item thuộc suggestion.
- Kiểm tra quyền assign task.
- Kiểm tra employee thuộc team của task nếu task có `teamId`.
- Mark item được chọn.
- Set suggestion status thành `SELECTED`.
- Update `tasks.assigneeId`.
- Update `tasks.assignedByUserId`.
- Tạo `task_assignments`.
- Ghi audit log.

## 5. Luồng tạo gợi ý AI

Luồng trong `AiTaskSuggestionsService.generate()`:

### Bước 1. Kiểm tra quyền

Backend gọi:

```ts
accessControl.ensureCanGenerateTaskSuggestion(actor, taskId)
```

Rule:

- Admin được quyền.
- Manager được quyền nếu đọc được task theo scope.
- Employee không được generate AI suggestion.

### Bước 2. Lấy task

Backend lấy task theo `taskId`, kèm:

- Required skills.
- Skill detail.
- Project.
- Team id.
- Start date.
- Due date.

Nếu task không tồn tại hoặc đã bị xóa mềm:

```txt
TASK_NOT_FOUND
```

### Bước 3. Lấy candidate theo quyền

Backend gọi:

```ts
accessControl.candidateEmployeeIdsForTask(actor)
```

Rule candidate:

- Admin: tất cả employee active.
- Manager: chính manager + nhân viên trong phạm vi team/subordinate.
- Employee: không có candidate.

### Bước 4. Lọc candidate theo team của task

Nếu task có `teamId`, backend chỉ giữ candidate thuộc team đó.

Điểm này đã được siết lại để tránh tình trạng AI gợi ý người không thể chọn.

Rule:

- Nếu task không có team thì giữ danh sách candidate theo quyền.
- Nếu task có team thì chỉ giữ:
  - thành viên active của team,
  - team lead nếu lead nằm trong candidate scope.

Nếu sau khi lọc không còn ai:

```txt
AI_SUGGESTION_NO_CANDIDATES
```

### Bước 5. Lấy thông tin nhân viên và workload

Backend lấy:

- Employee.
- Department.
- Position.
- Employee skills.
- Workload summary.

Workload summary đến từ `TaskWorkloadService`.

### Bước 6. Tính điểm từng nhân viên

Với mỗi employee:

- Tính `skillScore`.
- Tính `workloadScore`.
- Tính `availabilityScore`.
- Tính `score` tổng.
- Sinh `reason`.

### Bước 7. Sắp xếp và lấy top N

Backend sort giảm dần theo `score`.

Sau đó lấy:

```ts
slice(0, dto.limit ?? 5)
```

Rồi gán rank:

```txt
rank = index + 1
```

### Bước 8. Lưu suggestion vào database

Backend tạo:

- 1 record `ai_task_suggestions`.
- N records `ai_task_suggestion_items`.

### Bước 9. Ghi audit log

Action:

```txt
GENERATE_AI_TASK_SUGGESTION
```

## 6. Công thức tính điểm

### 6.1 Tổng điểm khi có availability

Nếu `includeAvailability = true`:

```txt
finalScore = skillScore * 0.50
           + workloadScore * 0.35
           + availabilityScore * 0.15
```

### 6.2 Tổng điểm khi không tính availability

Nếu `includeAvailability = false`:

```txt
finalScore = skillScore * 0.60
           + workloadScore * 0.40
```

Điểm được làm tròn 2 chữ số thập phân.

## 7. Cách tính skillScore

File chính:

```txt
ai-task-suggestions.service.ts
```

Function:

```ts
skillScore(requiredSkills, employeeSkills)
```

### 7.1 Nếu task chưa có required skills

Nếu task chưa khai báo kỹ năng yêu cầu:

```txt
skillScore = 70
```

Lý do: task chưa có dữ liệu kỹ năng thì không nên cho 0 điểm, nhưng cũng không nên cho 100 điểm.

### 7.2 Mapping proficiency

Backend đang map:

```txt
BEGINNER      = 40
INTERMEDIATE = 65
ADVANCED     = 85
EXPERT       = 100
```

### 7.3 So sánh proficiency nhân viên với yêu cầu task

Nếu employee có skill:

- Lấy điểm theo proficiency thật của employee.
- Nếu task có `requiredProficiency` mà employee thấp hơn yêu cầu thì trừ 15 điểm.
- Nếu employee đạt hoặc vượt yêu cầu thì giữ điểm proficiency.

Ví dụ:

```txt
Task yêu cầu ADVANCED NestJS
Employee có INTERMEDIATE NestJS
Base score = 65
Do thấp hơn yêu cầu ADVANCED nên score = 65 - 15 = 50
```

### 7.4 Bonus theo kinh nghiệm

Backend cộng thêm điểm theo `yearsExperience`:

```txt
> 4 năm   => +15
>= 2 năm  => +10
>= 1 năm  => +5
< 1 năm   => +0
```

Điểm mỗi skill không vượt quá 100.

### 7.5 Nếu employee thiếu skill

Nếu task yêu cầu skill mà employee không có:

- Nếu `isRequired = true`: điểm skill đó = 0.
- Nếu `isRequired = false`: điểm skill đó = 30.

### 7.6 Tính weighted average

Mỗi required skill có `weight`.

Công thức:

```txt
skillScore = tổng(skillPoint * weight) / tổng(weight)
```

Ví dụ:

```txt
Task yêu cầu:
- NestJS weight 1.5
- Prisma weight 1.0
- PostgreSQL weight 1.0

Employee:
- NestJS 95 điểm
- Prisma 85 điểm
- PostgreSQL 75 điểm

skillScore = (95*1.5 + 85*1.0 + 75*1.0) / 3.5
```

## 8. Cách tính workloadScore

File chính:

```txt
task-workload.service.ts
```

Backend chỉ tính task active:

```txt
TODO
IN_PROGRESS
IN_REVIEW
```

Không tính:

```txt
DONE
CANCELLED
deletedAt != null
```

### 8.1 Các thông số workload

Với mỗi employee:

- `activeTaskCount`: số task active.
- `totalEstimatedHours`: tổng estimated hours của task active.
- `overdueTaskCount`: số task active quá hạn.
- `capacityHoursPerWeek`: mặc định 40 giờ/tuần.
- `availableHours`: `40 - totalEstimatedHours`.
- `workloadScore`: điểm tải việc.

Nếu task không có `estimatedHours`, backend tạm tính mặc định:

```txt
4 giờ/task
```

### 8.2 Base workload score

```txt
availableHours >= 20  => 100
availableHours >= 10  => 80
availableHours >= 5   => 60
availableHours > 0    => 40
availableHours <= 0   => 20
```

### 8.3 Trừ điểm quá hạn

Mỗi task quá hạn trừ 10 điểm:

```txt
workloadScore = baseScore - overdueTaskCount * 10
```

Điểm thấp nhất là 0.

## 9. Cách tính availabilityScore

File chính:

```txt
ai-task-suggestions.service.ts
```

Nếu `includeAvailability = false`:

```txt
availabilityScore = 100
```

Nếu `includeAvailability = true`, backend kiểm tra đơn nghỉ:

- Employee có leave request `APPROVED`.
- Khoảng nghỉ overlap với `task.startDate` đến `task.dueDate`.

Nếu có overlap:

```txt
availabilityScore = 40
```

Nếu không có overlap:

```txt
availabilityScore = 100
```

Nếu task không có start/due date:

```txt
availabilityScore = 100
```

## 10. Reason được sinh như nào

Backend sinh câu giải thích dạng:

```txt
<Tên nhân viên> phù hợp với kỹ năng yêu cầu (<skills>),
còn <availableHours>h khả dụng/tuần,
<activeTaskCount> task active,
không có lịch nghỉ trùng deadline.
```

Nếu task chưa có required skill:

```txt
task chưa yêu cầu kỹ năng cụ thể
```

Nếu có nghỉ phép trùng deadline:

```txt
có lịch nghỉ cần cân nhắc
```

Lưu ý: reason hiện là text tiếng Việt bị encode hơi lỗi ở một vài source/comment cũ trong repo. Logic vẫn đúng, nhưng nên chuẩn hóa encoding/text sau để UI đẹp hơn.

## 11. Luồng chọn gợi ý AI

Luồng trong `AiTaskSuggestionsService.select()`:

### Bước 1. Lấy suggestion

Backend tìm suggestion theo id, kèm:

- Items.
- Task.

Nếu không có:

```txt
AI_TASK_SUGGESTION_NOT_FOUND
```

### Bước 2. Kiểm tra trạng thái suggestion

Chỉ cho chọn nếu:

```txt
status = GENERATED
```

Nếu đã selected/expired/cancelled:

```txt
AI_SUGGESTION_ALREADY_SELECTED
```

### Bước 3. Kiểm tra item

Item phải thuộc suggestion.

Nếu không có:

```txt
AI_TASK_SUGGESTION_ITEM_NOT_FOUND
```

### Bước 4. Kiểm tra quyền assign

Backend gọi:

```ts
accessControl.ensureCanAssignTask(actor, suggestion.taskId, item.employeeId)
```

Rule:

- Admin assign được theo quyền toàn hệ thống.
- Manager chỉ assign được trong scope.
- Employee không assign được.

### Bước 5. Kiểm tra employee thuộc team của task

Nếu task có `teamId`, employee được chọn phải là thành viên active của team.

Nếu không:

```txt
VALIDATION_ERROR
```

Thông điệp:

```txt
Task assignee must belong to selected team
```

### Bước 6. Transaction assign

Backend chạy transaction:

- Set tất cả suggestion items `selected = false`.
- Set item được chọn `selected = true`.
- Set suggestion `status = SELECTED`.
- Update task:
  - `assigneeId = item.employeeId`
  - `assignedByUserId = actor.id`
- Tạo `task_assignments`:
  - `assignmentType = AI_SUGGESTED`
  - `note = dto.note`

### Bước 7. Audit log

Backend ghi:

```txt
SELECT_AI_TASK_SUGGESTION
ASSIGN_TASK
```

## 12. ABAC trong AI gợi ý

AI không được bỏ qua phân quyền. Nó dùng chung `AccessControlService`.

### 12.1 Admin

Admin có thể:

- Tạo gợi ý cho task toàn hệ thống.
- Candidate ban đầu là tất cả employee active.
- Nếu task có team thì candidate vẫn bị lọc theo team.

### 12.2 Manager

Manager có thể:

- Tạo gợi ý cho task trong phạm vi mình đọc được.
- Candidate ban đầu là manager + cấp dưới/team.
- Nếu task có team thì candidate bị lọc tiếp theo team.
- Khi select vẫn bị kiểm tra lại quyền assign.

### 12.3 Employee

Employee không được:

- Generate AI suggestion.
- Select AI suggestion.
- Assign task cho người khác.

## 13. Ví dụ luồng thực tế

Giả sử task:

```txt
Title: Implement AI assignment score review
Required skills:
- NESTJS ADVANCED weight 1.2
- TYPESCRIPT ADVANCED weight 1.0
- TESTING INTERMEDIATE weight 0.7
Due date: 2026-06-20
Team: Backend Team
```

Manager bấm AI gợi ý:

```http
POST /tasks/100/ai-suggestions
```

Body:

```json
{
  "limit": 5,
  "includeAvailability": true
}
```

Backend:

- Lấy task 100.
- Lấy danh sách candidate trong scope manager.
- Lọc candidate thuộc Backend Team.
- Lấy skill của từng employee.
- Lấy workload.
- Kiểm tra leave approved overlap deadline.
- Tính điểm.
- Trả top 5.

Response dạng:

```json
{
  "suggestionId": 1,
  "taskId": 100,
  "algorithmVersion": "rule-based-v1",
  "status": "GENERATED",
  "items": [
    {
      "suggestionItemId": 10,
      "employeeId": 5,
      "fullName": "Tran Anh Khoa",
      "rank": 1,
      "score": 86.5,
      "skillScore": 92,
      "workloadScore": 78,
      "availabilityScore": 100,
      "reason": "..."
    }
  ]
}
```

Manager chọn người rank 1:

```http
POST /ai-task-suggestions/1/select
```

Body:

```json
{
  "suggestionItemId": 10,
  "note": "Chọn theo gợi ý AI vì phù hợp kỹ năng và còn tải việc."
}
```

Backend assign task cho employee 5 và ghi lịch sử.

## 14. Điểm đã cải thiện gần đây

Các cải thiện vừa làm ở backend:

### 14.1 Không để AI gợi ý người ngoài team

Trước đó:

- AI có thể generate candidate theo scope Admin/Manager.
- Nếu task thuộc team cụ thể, vẫn có rủi ro danh sách gợi ý chứa người không thuộc team.
- Lúc select có thể bị chặn, nhưng UI sẽ thấy một gợi ý không chọn được.

Hiện tại:

- Generate đã lọc candidate theo team của task.
- Select vẫn kiểm tra lại team membership.

### 14.2 Chọn AI suggestion kiểm tra team trước khi assign

Hiện tại select sẽ chặn nếu item không thuộc team task.

### 14.3 Update task đổi assignee có ghi history

Nếu `PATCH /tasks/:id` đổi `assigneeId`, backend giờ tạo `task_assignments` và audit assign/reassign.

Điều này giúp lịch sử giao task không bị lệch.

### 14.4 Validate ngày task/project chắc hơn

Update task/project giờ validate ngày sau khi merge dữ liệu mới với dữ liệu cũ.

Ví dụ:

- Project cũ có `endDate = 2026-06-20`.
- Request chỉ update `startDate = 2026-07-01`.
- Backend sẽ bắt lỗi vì startDate mới vượt endDate cũ.

## 15. Hạn chế hiện tại

### 15.1 Chưa phải AI/ML thật

Hiện tại là rule-based scoring.

Ưu điểm:

- Dễ giải thích.
- Dễ demo.
- Dễ bảo vệ đồ án.
- Không phụ thuộc API ngoài.
- Không có rủi ro model hallucination.

Nhược điểm:

- Không học từ dữ liệu lịch sử.
- Không tự cải thiện theo feedback.
- Điểm số phụ thuộc rule thủ công.

### 15.2 Workload còn tính đơn giản

Hiện chỉ dựa vào:

- Task active.
- Estimated hours.
- Overdue tasks.

Chưa tính:

- Task complexity.
- Priority impact.
- Work calendar.
- Part-time/capacity riêng từng nhân viên.
- Meeting load.
- Leave dài ngày ngoài overlap đơn giản.

### 15.3 Availability còn đơn giản

Hiện chỉ:

- Có leave approved overlap => 40.
- Không overlap => 100.

Chưa tính:

- Nghỉ 1 ngày trong task dài 30 ngày thì impact nên thấp hơn.
- Nghỉ dài gần hết task thì impact nên cao hơn.
- Ngày nghỉ lễ.
- Weekend.
- Work calendar riêng.

### 15.4 Reason còn đơn giản

Reason hiện mô tả tốt ở mức demo, nhưng có thể nâng cấp:

- Nêu skill nào match mạnh.
- Nêu skill nào thiếu.
- Nêu task overdue đang ảnh hưởng workload.
- Nêu cụ thể ngày nghỉ overlap.

### 15.5 Chưa có feedback loop

Hệ thống chưa lưu:

- Manager có đồng ý với gợi ý không.
- Gợi ý bị bỏ qua vì sao.
- Task sau khi assign có hoàn thành tốt không.
- Người được chọn có quá tải sau đó không.

## 16. Nên cải thiện tiếp ở backend

Ưu tiên trước khi làm web:

### 16.1 Tối ưu workload bằng aggregate

Hiện workload tính từng employee. Nếu nhiều employee sẽ nhiều query.

Nên cải thiện:

- Dùng `groupBy assigneeId`.
- Tính estimated hours và count theo nhóm.
- Tính overdue theo query riêng hoặc aggregate thủ công sau một query.

### 16.2 Thêm option loại người tạo task khỏi candidate

Hiện manager có thể nằm trong candidate.

Nên thêm option:

```json
{
  "includeSelf": false
}
```

Hoặc mặc định không gợi ý chính requester nếu requester là manager.

### 16.3 Cải thiện availability score theo tỉ lệ ngày nghỉ

Thay vì 40/100, có thể tính:

```txt
availabilityScore = 100 - overlapWorkDays / taskWorkDays * 60
```

Ví dụ:

- Task 10 ngày, nghỉ 1 ngày => availability khoảng 94.
- Task 5 ngày, nghỉ 4 ngày => availability thấp.

### 16.4 Cải thiện reason

Reason nên gồm:

- Skill matched.
- Skill missing.
- Workload detail.
- Leave overlap detail.
- Kết luận ngắn.

### 16.5 Thêm integration test ABAC

Nên test bằng database test hoặc mock sâu hơn:

- Manager không generate suggestion cho task ngoài scope.
- Manager không thấy suggestion ngoài scope.
- Admin generate được toàn hệ thống.
- Task có team thì AI chỉ gợi ý thành viên team.
- Select suggestion tạo assignment đúng.
- Select suggestion không được gọi lần hai.

### 16.6 Thêm trạng thái EXPIRED/CANCELLED cho suggestion

Hiện status enum đã có:

```txt
GENERATED
SELECTED
EXPIRED
CANCELLED
```

Nhưng chưa có job/API rõ để expire/cancel.

Có thể bổ sung:

- `POST /ai-task-suggestions/:id/cancel`
- Tự expire suggestion sau X ngày hoặc khi task đã DONE/CANCELLED.

## 17. Vì sao cách này phù hợp đồ án

Cách làm rule-based phù hợp vì:

- Có yếu tố "AI hỗ trợ" nhưng vẫn kiểm soát được.
- Giải thích được vì sao nhân viên được gợi ý.
- Không để AI tự assign.
- Có audit log.
- Có lịch sử suggestion.
- Có điểm số minh bạch.
- Có thể mở rộng sang ML/model thật sau.

Khi bảo vệ có thể nói:

```txt
Module AI Task Assignment Suggestion hiện sử dụng rule-based recommendation engine.
Hệ thống phân tích kỹ năng, workload và lịch nghỉ phép để xếp hạng nhân viên phù hợp.
AI chỉ đưa ra gợi ý có giải thích, còn Manager/Admin là người chọn cuối cùng.
Mỗi lần gợi ý và mỗi lần chọn đều được lưu lịch sử và audit log để đảm bảo minh bạch.
```

## 18. Tóm tắt một câu

AI gợi ý chia task trong OmniHR hiện là một engine rule-based minh bạch: nó chấm điểm nhân viên dựa trên kỹ năng, tải việc và lịch nghỉ; lưu lại toàn bộ kết quả gợi ý; sau đó để manager/admin chọn người nhận task, đồng thời ghi lịch sử assign và audit log.
