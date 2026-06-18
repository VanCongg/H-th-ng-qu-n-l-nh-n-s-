# CoreHR — Phase 2 Specification: Task Management & AI Task Assignment

> Tài liệu này dùng để định hướng triển khai **Phase 2** cho hệ thống CoreHR sau khi hoàn thành Phase 1.  
> Phase 2 tập trung vào: **quản lý dự án, quản lý task, quản lý kỹ năng và nền tảng AI gợi ý giao task**.  
> Chatbot AI sau này có thể đặt tên là **HRGenie**, nhưng trong Phase 2 chỉ cần làm nền tảng AI gợi ý giao task, chưa cần chatbot hoàn chỉnh.

---

## 1. Mục tiêu Phase 2

Phase 1 đã xây dựng nền tảng HRM lõi gồm:

```txt
Authentication
Authorization
RBAC
ABAC
Employee Management
Department Management
Position Management
Manager Relationship
Attendance
Leave Request
Leave Type
Audit Log
Web /admin cho ADMIN
Web /app cho MANAGER
Mobile App định hướng cho EMPLOYEE
```

Phase 2 sẽ mở rộng thêm:

```txt
Project Management
Task Management
Skill Management
Employee Skill Management
Task Required Skill Management
Manual Task Assignment
AI Task Assignment Suggestion
Suggestion History
Assignment History
```

Mục tiêu chính:

```txt
1. Cho phép ADMIN hoặc MANAGER tạo và giao task thủ công.
2. Cho phép ADMIN hoặc MANAGER bấm nút "Nhờ AI gợi ý".
3. Hệ thống phân tích kỹ năng, workload và deadline để gợi ý nhân viên phù hợp.
4. Người quản lý xem danh sách gợi ý, lý do gợi ý và điểm số.
5. Người quản lý chọn một nhân viên từ danh sách gợi ý để giao task.
6. Hệ thống ghi lại lịch sử gợi ý và lịch sử giao task.
```

Nguyên tắc quan trọng:

```txt
AI chỉ hỗ trợ gợi ý.
Con người vẫn là người quyết định cuối cùng.
AI không tự động giao task nếu chưa có xác nhận của ADMIN hoặc MANAGER.
```

---

## 2. Phạm vi Phase 2

### 2.1 Phase 2 gồm

```txt
Project Management
Task Management
Skill Management
Employee Skills
Task Required Skills
Manual Task Assignment
AI Task Suggestion
AI Suggestion Selection
Task Assignment History
Basic Workload Calculation
Permission mở rộng cho task/skill/project/AI
Web /admin mở rộng quản lý task/skill/project
Web /app mở rộng cho MANAGER giao task cho team
```

### 2.2 Phase 2 chưa làm

```txt
Chatbot HRGenie hoàn chỉnh
Machine Learning phức tạp
Fine-tuning model
Task dependency phức tạp
Task comment realtime
Task attachment
Kanban realtime nâng cao
Performance review nâng cao
KPI nâng cao
Payroll
Resource allocation request nâng cao
Workflow engine phức tạp
```

---

## 3. Vai trò sử dụng

Hệ thống vẫn giữ 3 role chính:

```txt
ADMIN
MANAGER
EMPLOYEE
```

### 3.1 ADMIN

ADMIN có quyền:

```txt
Quản lý toàn bộ project
Quản lý toàn bộ task
Quản lý toàn bộ skill
Quản lý skill của employee
Giao task cho bất kỳ employee nào
Nhờ AI gợi ý nhân viên cho task
Chọn nhân viên từ gợi ý AI
Xem toàn bộ lịch sử gợi ý và giao task
```

### 3.2 MANAGER

MANAGER có quyền:

```txt
Xem project/task liên quan team mình
Tạo task cho team mình nếu được cấp quyền
Giao task cho cấp dưới
Nhờ AI gợi ý nhân viên trong phạm vi cấp dưới
Chọn nhân viên từ gợi ý AI
Xem workload cơ bản của cấp dưới
Xem lịch sử task của team
```

MANAGER bị giới hạn bởi ABAC:

```txt
Chỉ giao task cho employee là cấp dưới active trong employee_managers.
Chỉ xem task thuộc team/cấp dưới.
Không được giao task cho employee ngoài phạm vi quản lý.
Không được xem workload của employee ngoài team.
```

### 3.3 EMPLOYEE

EMPLOYEE có quyền:

```txt
Xem task được giao cho mình
Cập nhật trạng thái task của mình nếu được phép
Xem thông tin kỹ năng cá nhân nếu hệ thống cho phép
```

EMPLOYEE không được:

```txt
Giao task cho người khác
Nhờ AI gợi ý giao task
Xem gợi ý AI của manager/admin
Xem workload của người khác
```

---

## 4. Module cần thêm

Phase 2 nên thêm các module backend sau:

```txt
projects
tasks
skills
employee-skills
task-required-skills
task-assignments
ai-task-suggestions
task-workload
```

Cấu trúc source backend gợi ý:

```txt
src/
 ├── projects/
 ├── tasks/
 ├── skills/
 ├── employee-skills/
 ├── task-required-skills/
 ├── task-assignments/
 ├── ai-task-suggestions/
 ├── task-workload/
 └── common/
      └── services/
           ├── access-control.service.ts
           └── task-recommendation.service.ts
```

Cấu trúc frontend gợi ý:

```txt
src/
 ├── features/
 │    ├── projects/
 │    ├── tasks/
 │    ├── skills/
 │    ├── employee-skills/
 │    ├── task-assignment/
 │    ├── ai-task-suggestions/
 │    └── workload/
```

---

## 5. Database Design Phase 2

Phase 2 thêm 8 bảng chính:

```txt
1. projects
2. tasks
3. skills
4. employee_skills
5. task_required_skills
6. task_assignments
7. ai_task_suggestions
8. ai_task_suggestion_items
```

Có thể thêm sau nếu cần:

```txt
employee_workload_snapshots
employee_availability
task_comments
task_attachments
task_dependencies
performance_reviews
```

Phase 2 bản đầu chưa cần các bảng mở rộng này.

---

# 6. Database Tables Chi tiết

## 6.1 projects

Dùng để nhóm các task theo dự án.

```sql
CREATE TABLE projects (
    id BIGSERIAL PRIMARY KEY,
    department_id BIGINT REFERENCES departments(id),
    manager_id BIGINT REFERENCES employees(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE'
        CHECK (status IN ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
    start_date DATE,
    end_date DATE,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

Ghi chú:

```txt
department_id: phòng ban phụ trách project.
manager_id: người quản lý chính của project.
created_by: user tạo project.
deleted_at: soft delete.
```

---

## 6.2 tasks

Bảng task chính.

```sql
CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT REFERENCES projects(id),
    department_id BIGINT REFERENCES departments(id),

    title VARCHAR(255) NOT NULL,
    description TEXT,

    priority VARCHAR(50) DEFAULT 'MEDIUM'
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),

    status VARCHAR(50) DEFAULT 'TODO'
        CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED')),

    assignee_id BIGINT REFERENCES employees(id),
    created_by BIGINT REFERENCES users(id),
    assigned_by BIGINT REFERENCES users(id),

    start_date DATE,
    due_date DATE,
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2),

    completed_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

Rule:

```txt
Task có thể chưa có assignee_id khi mới tạo.
Task có thể được giao thủ công hoặc giao sau khi chọn gợi ý AI.
MANAGER chỉ được tạo/giao task cho cấp dưới.
ADMIN được tạo/giao task toàn hệ thống.
Không hard delete task, dùng soft delete.
```

---

## 6.3 skills

Danh mục kỹ năng.

```sql
CREATE TABLE skills (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Ví dụ seed skill:

```txt
REACT
NESTJS
POSTGRESQL
PRISMA
TYPESCRIPT
UI_UX
TESTING
ANDROID
FLUTTER
DOCKER
```

---

## 6.4 employee_skills

Lưu kỹ năng của nhân viên.

```sql
CREATE TABLE employee_skills (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    skill_id BIGINT NOT NULL REFERENCES skills(id),

    years_experience NUMERIC(4,1),
    proficiency VARCHAR(50)
        CHECK (proficiency IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),

    last_used_at DATE,
    note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (employee_id, skill_id)
);
```

Ghi chú:

```txt
years_experience thể hiện số năm kinh nghiệm thực tế.
proficiency dùng dạng chữ thay vì level số 1-5 để dễ hiểu hơn.
```

---

## 6.5 task_required_skills

Lưu kỹ năng mà task yêu cầu.

```sql
CREATE TABLE task_required_skills (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id),
    skill_id BIGINT NOT NULL REFERENCES skills(id),

    required_proficiency VARCHAR(50)
        CHECK (required_proficiency IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')),

    weight NUMERIC(4,2) DEFAULT 1.0,
    is_required BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (task_id, skill_id)
);
```

Ghi chú:

```txt
is_required = true: kỹ năng bắt buộc.
is_required = false: kỹ năng phụ, có thì tốt.
weight dùng để tính điểm khớp kỹ năng.
```

---

## 6.6 task_assignments

Lưu lịch sử giao task.

```sql
CREATE TABLE task_assignments (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id),
    assignee_id BIGINT NOT NULL REFERENCES employees(id),
    assigned_by BIGINT NOT NULL REFERENCES users(id),

    assignment_type VARCHAR(50) NOT NULL
        CHECK (assignment_type IN ('MANUAL', 'AI_SUGGESTED', 'REASSIGNED')),

    note TEXT,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Rule:

```txt
Mỗi lần giao hoặc đổi người phụ trách task đều ghi task_assignments.
tasks.assignee_id lưu người đang được giao hiện tại.
task_assignments lưu lịch sử.
```

---

## 6.7 ai_task_suggestions

Lưu mỗi lần người quản lý nhờ AI gợi ý.

```sql
CREATE TABLE ai_task_suggestions (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id),
    requested_by BIGINT NOT NULL REFERENCES users(id),

    algorithm_version VARCHAR(50) DEFAULT 'rule-based-v1',
    input_snapshot JSONB,
    status VARCHAR(50) DEFAULT 'GENERATED'
        CHECK (status IN ('GENERATED', 'SELECTED', 'EXPIRED', 'CANCELLED')),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6.8 ai_task_suggestion_items

Lưu từng nhân viên trong danh sách gợi ý.

```sql
CREATE TABLE ai_task_suggestion_items (
    id BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES ai_task_suggestions(id),
    employee_id BIGINT NOT NULL REFERENCES employees(id),

    rank INT NOT NULL,
    score NUMERIC(5,2) NOT NULL,

    skill_score NUMERIC(5,2),
    workload_score NUMERIC(5,2),
    availability_score NUMERIC(5,2),
    performance_score NUMERIC(5,2),

    reason TEXT,
    selected BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (suggestion_id, employee_id)
);
```

---

# 7. Workload Calculation

Phase 2 chưa cần bảng workload riêng. Có thể tính workload trực tiếp từ bảng `tasks`.

## 7.1 Công thức workload cơ bản

```txt
active_task_count = số task đang có status TODO / IN_PROGRESS / IN_REVIEW
total_estimated_hours = tổng estimated_hours của các task active
overdue_task_count = số task active có due_date < today
capacity_hours_per_week = mặc định 40 giờ
available_hours = capacity_hours_per_week - total_estimated_hours
```

## 7.2 Rule tính workload

```txt
Chỉ tính task chưa DONE/CANCELLED.
Nếu estimated_hours null thì có thể tính mặc định 4 giờ/task hoặc bỏ qua.
Nếu employee có leave request APPROVED trong khoảng thời gian task thì giảm điểm availability.
Nếu employee đang có nhiều task overdue thì giảm điểm workload.
```

---

# 8. AI Recommendation Logic

Ở mức đồ án, Phase 2 chưa cần machine learning thật. Nên triển khai dạng:

```txt
Rule-based recommendation engine
```

Có thể giới thiệu là:

```txt
AI-assisted task assignment suggestion
```

## 8.1 Tiêu chí gợi ý

AI gợi ý dựa trên:

```txt
1. Skill matching
2. Workload hiện tại
3. Availability theo deadline
4. Lịch nghỉ phép đã được duyệt
5. Performance score nếu phase sau có
```

Phase 2 bản đầu dùng 2 tiêu chí chính:

```txt
skill_score
workload_score
```

Có thể thêm availability nếu đã có leave request.

## 8.2 Công thức điểm Phase 2 bản đầu

```txt
final_score = skill_score * 0.60 + workload_score * 0.40
```

Nếu thêm availability:

```txt
final_score =
  skill_score * 0.50
+ workload_score * 0.35
+ availability_score * 0.15
```

Nếu sau này có performance:

```txt
final_score =
  skill_score * 0.45
+ workload_score * 0.30
+ availability_score * 0.15
+ performance_score * 0.10
```

## 8.3 Tính skill_score

Pseudo logic:

```txt
1. Lấy danh sách skill yêu cầu của task.
2. Lấy danh sách skill của employee.
3. Với mỗi skill yêu cầu:
   - Nếu employee không có skill đó: điểm thấp hoặc 0.
   - Nếu employee có skill đó: cộng điểm theo proficiency và years_experience.
4. Nhân với weight của skill.
5. Chuẩn hóa về thang 0 - 100.
```

Gợi ý mapping proficiency:

```txt
BEGINNER      = 40
INTERMEDIATE = 65
ADVANCED     = 85
EXPERT       = 100
```

Bonus years_experience:

```txt
0 - 1 năm     = +0
1 - 2 năm     = +5
2 - 4 năm     = +10
> 4 năm       = +15
```

Điểm tối đa mỗi skill không vượt quá 100.

## 8.4 Tính workload_score

Pseudo logic:

```txt
1. Tính total_estimated_hours của task active.
2. So sánh với capacity_hours_per_week.
3. Người càng rảnh thì điểm càng cao.
4. Người nhiều task overdue bị trừ điểm.
```

Ví dụ:

```txt
available_hours >= 20  => workload_score = 100
available_hours >= 10  => workload_score = 80
available_hours >= 5   => workload_score = 60
available_hours > 0    => workload_score = 40
available_hours <= 0   => workload_score = 20
```

Trừ overdue:

```txt
workload_score = workload_score - overdue_task_count * 10
```

Điểm cuối nằm trong khoảng 0 - 100.

---

# 9. API Design Phase 2

## 9.1 Projects API

```http
GET /projects
GET /projects/:id
POST /projects
PATCH /projects/:id
DELETE /projects/:id
```

Rule:

```txt
ADMIN quản lý toàn bộ project.
MANAGER xem project liên quan team mình.
```

## 9.2 Tasks API

```http
GET /tasks
GET /tasks/team
GET /tasks/me
GET /tasks/:id
POST /tasks
PATCH /tasks/:id
DELETE /tasks/:id
POST /tasks/:id/assign
PATCH /tasks/:id/status
```

Rule:

```txt
ADMIN xem/giao toàn bộ task.
MANAGER xem/giao task trong team.
EMPLOYEE xem task của mình.
```

Create task body gợi ý:

```json
{
  "projectId": 1,
  "departmentId": 1,
  "title": "Build leave request API",
  "description": "Implement create, approve and reject leave request APIs",
  "priority": "HIGH",
  "startDate": "2026-07-01",
  "dueDate": "2026-07-05",
  "estimatedHours": 12,
  "requiredSkills": [
    {
      "skillId": 1,
      "requiredProficiency": "INTERMEDIATE",
      "weight": 0.5,
      "isRequired": true
    }
  ]
}
```

Assign task body:

```json
{
  "assigneeId": 10,
  "note": "Giao thủ công bởi manager"
}
```

## 9.3 Skills API

```http
GET /skills
GET /skills/:id
POST /skills
PATCH /skills/:id
DELETE /skills/:id
```

## 9.4 Employee Skills API

```http
GET /employees/:id/skills
POST /employees/:id/skills
PATCH /employee-skills/:id
DELETE /employee-skills/:id
```

## 9.5 AI Task Suggestion API

```http
POST /tasks/:id/ai-suggestions
GET /tasks/:id/ai-suggestions
GET /ai-task-suggestions/:id
POST /ai-task-suggestions/:id/select
```

### POST /tasks/:id/ai-suggestions

Ý nghĩa:

```txt
Tạo danh sách gợi ý nhân viên phù hợp cho task.
```

Request body:

```json
{
  "limit": 5,
  "includeAvailability": true
}
```

Response:

```json
{
  "success": true,
  "message": "AI task suggestions generated successfully",
  "data": {
    "suggestionId": 1,
    "taskId": 100,
    "algorithmVersion": "rule-based-v1",
    "items": [
      {
        "suggestionItemId": 1,
        "employeeId": 10,
        "fullName": "Nguyễn Văn A",
        "rank": 1,
        "score": 87.5,
        "skillScore": 90,
        "workloadScore": 84,
        "availabilityScore": 100,
        "reason": "Có kỹ năng NestJS và Prisma phù hợp, workload hiện tại thấp và không có lịch nghỉ trong thời gian task."
      }
    ]
  }
}
```

### POST /ai-task-suggestions/:id/select

Ý nghĩa:

```txt
Manager/Admin chọn một gợi ý để giao task.
```

Request body:

```json
{
  "suggestionItemId": 1,
  "note": "Chọn theo gợi ý AI vì phù hợp kỹ năng và workload thấp."
}
```

Backend xử lý:

```txt
1. Kiểm tra suggestion tồn tại.
2. Kiểm tra suggestion item thuộc suggestion.
3. Kiểm tra quyền người chọn.
4. Kiểm tra employee được chọn có trong phạm vi của MANAGER không.
5. Update tasks.assignee_id.
6. Update tasks.assigned_by.
7. Update ai_task_suggestions.status = SELECTED.
8. Update ai_task_suggestion_items.selected = true.
9. Tạo task_assignments với assignment_type = AI_SUGGESTED.
10. Ghi audit log SELECT_AI_TASK_SUGGESTION và ASSIGN_TASK.
```

---

# 10. RBAC Permission Phase 2

Seed thêm permissions:

```txt
PROJECT_CREATE
PROJECT_READ_ALL
PROJECT_READ_TEAM
PROJECT_UPDATE
PROJECT_DELETE

TASK_CREATE
TASK_READ_ALL
TASK_READ_TEAM
TASK_READ_SELF
TASK_UPDATE
TASK_DELETE
TASK_ASSIGN
TASK_UPDATE_STATUS

SKILL_CREATE
SKILL_READ
SKILL_UPDATE
SKILL_DELETE

EMPLOYEE_SKILL_CREATE
EMPLOYEE_SKILL_READ
EMPLOYEE_SKILL_UPDATE
EMPLOYEE_SKILL_DELETE

AI_TASK_SUGGEST
AI_TASK_SELECT

TASK_ASSIGNMENT_READ
```

## 10.1 ADMIN permissions

ADMIN có toàn quyền Phase 2.

## 10.2 MANAGER permissions

```txt
PROJECT_READ_TEAM
TASK_CREATE
TASK_READ_TEAM
TASK_UPDATE
TASK_ASSIGN
TASK_UPDATE_STATUS
SKILL_READ
EMPLOYEE_SKILL_READ
AI_TASK_SUGGEST
AI_TASK_SELECT
TASK_ASSIGNMENT_READ
```

ABAC:

```txt
MANAGER chỉ thao tác với task/team/cấp dưới thuộc phạm vi quản lý.
```

## 10.3 EMPLOYEE permissions

```txt
TASK_READ_SELF
TASK_UPDATE_STATUS
EMPLOYEE_SKILL_READ
```

ABAC:

```txt
EMPLOYEE chỉ xem task của chính mình.
EMPLOYEE chỉ cập nhật trạng thái task của mình nếu được phép.
EMPLOYEE chỉ xem skill của chính mình.
```

---

# 11. ABAC Phase 2

Bổ sung vào `AccessControlService`:

```ts
canReadProject(currentUser, projectId): Promise<boolean>
canCreateTask(currentUser, payload): Promise<boolean>
canReadTask(currentUser, taskId): Promise<boolean>
canUpdateTask(currentUser, taskId): Promise<boolean>
canAssignTask(currentUser, taskId, assigneeEmployeeId): Promise<boolean>
canGenerateTaskSuggestion(currentUser, taskId): Promise<boolean>
canSelectTaskSuggestion(currentUser, suggestionId, suggestionItemId): Promise<boolean>
canReadEmployeeSkill(currentUser, employeeId): Promise<boolean>
canUpdateEmployeeSkill(currentUser, employeeId): Promise<boolean>
```

Rule:

```txt
ADMIN pass toàn bộ.
MANAGER chỉ pass nếu task/project/assignee thuộc phạm vi cấp dưới.
EMPLOYEE chỉ pass nếu task.assignee_id = current_employee.id.
```

---

# 12. Web Admin Phase 2

Mở rộng menu `/admin`:

```txt
Dashboard
Employees
Departments
Positions
Managers
Attendance
Leave Requests
Leave Types
Projects
Tasks
Skills
Employee Skills
AI Task Suggestions
Users
Roles & Permissions
Audit Logs
System Settings
```

## 12.1 Project Management

```txt
Xem danh sách project
Tạo project
Sửa project
Xóa mềm project
Gán department
Gán project manager
Lọc theo status/department/manager
```

## 12.2 Task Management

```txt
Xem toàn bộ task
Tạo task
Sửa task
Xóa mềm task
Giao task thủ công
Bấm "Nhờ AI gợi ý"
Xem danh sách gợi ý
Chọn nhân viên từ gợi ý
Xem lịch sử giao task
Lọc theo project, assignee, status, priority, deadline
```

## 12.3 Skill Management

```txt
Xem danh sách skill
Tạo skill
Sửa skill
Bật/tắt skill
```

## 12.4 Employee Skill Management

```txt
Xem skill của employee
Thêm skill cho employee
Sửa years_experience/proficiency
Xóa skill khỏi employee
```

## 12.5 AI Task Suggestions

```txt
Xem lịch sử các lần nhờ AI gợi ý
Xem task liên quan
Xem ai yêu cầu gợi ý
Xem danh sách nhân viên được gợi ý
Xem điểm số và lý do
Xem gợi ý nào đã được chọn
```

---

# 13. Web /app Phase 2 cho Manager

Mở rộng menu `/app`:

```txt
Dashboard
My Team
Team Attendance
Team Leave Requests
Projects
Team Tasks
Assign Task
AI Task Suggestions
My Profile
```

## 13.1 Team Tasks

```txt
Xem task của team
Tạo task cho team
Giao task thủ công cho cấp dưới
Bấm "Nhờ AI gợi ý"
Chọn nhân viên từ danh sách gợi ý
Theo dõi trạng thái task
```

## 13.2 Assign Task

Luồng giao task thủ công:

```txt
1. Manager tạo task.
2. Nhập title, description, deadline, priority, estimated_hours.
3. Chọn required skills nếu có.
4. Chọn assignee trong danh sách cấp dưới.
5. Submit.
6. Backend kiểm tra ABAC.
7. Task được giao cho employee.
```

## 13.3 AI Suggestion UI

Khi manager bấm "Nhờ AI gợi ý":

```txt
Hiển thị danh sách top 3 hoặc top 5 employee phù hợp.
Mỗi item hiển thị:
- Họ tên nhân viên
- Phòng ban/chức vụ
- Điểm tổng
- Điểm skill
- Điểm workload
- Điểm availability
- Lý do gợi ý
- Nút "Chọn người này"
```

UI nên dùng Mantine:

```txt
Card bo góc cho từng gợi ý
Badge cho điểm số
Progress bar hoặc ring progress nếu muốn
Button "Chọn"
Modal xác nhận trước khi assign
```

---

# 14. Audit Log Phase 2

Thêm action:

```txt
CREATE_PROJECT
UPDATE_PROJECT
DELETE_PROJECT

CREATE_TASK
UPDATE_TASK
DELETE_TASK
ASSIGN_TASK
REASSIGN_TASK
UPDATE_TASK_STATUS

CREATE_SKILL
UPDATE_SKILL
DELETE_SKILL

ADD_EMPLOYEE_SKILL
UPDATE_EMPLOYEE_SKILL
REMOVE_EMPLOYEE_SKILL

GENERATE_AI_TASK_SUGGESTION
SELECT_AI_TASK_SUGGESTION
```

---

# 15. Error Codes Phase 2

```txt
PROJECT_NOT_FOUND
TASK_NOT_FOUND
SKILL_NOT_FOUND
EMPLOYEE_SKILL_NOT_FOUND
TASK_REQUIRED_SKILL_NOT_FOUND
TASK_ASSIGNMENT_NOT_FOUND
AI_TASK_SUGGESTION_NOT_FOUND
AI_TASK_SUGGESTION_ITEM_NOT_FOUND

TASK_INVALID_STATUS
TASK_ASSIGNMENT_DENIED
TASK_ASSIGNEE_NOT_IN_MANAGER_SCOPE
TASK_REQUIRED_SKILL_INVALID
AI_SUGGESTION_NO_CANDIDATES
AI_SUGGESTION_ALREADY_SELECTED
AI_SUGGESTION_EXPIRED
```

---

# 16. Business Rules Phase 2

## 16.1 Project

```txt
Không xóa cứng project.
Không xóa project nếu còn task active, trừ khi soft delete toàn bộ hoặc từ chối.
Project có thể không bắt buộc department_id nếu muốn linh hoạt.
```

## 16.2 Task

```txt
Task phải có title.
Task có thể chưa có assignee.
Task có thể có nhiều required skills.
Task chỉ được assign cho employee active.
Task không assign cho employee RESIGNED/SUSPENDED.
Không assign task cho employee đang deleted.
Nếu MANAGER assign task, assignee phải là cấp dưới active.
Nếu ADMIN assign task, assignee có thể là bất kỳ employee active.
```

## 16.3 AI Suggestion

```txt
Chỉ ADMIN hoặc MANAGER được nhờ AI gợi ý.
MANAGER chỉ nhận gợi ý trong phạm vi cấp dưới.
AI chỉ gợi ý employee active.
AI không gợi ý employee RESIGNED/SUSPENDED.
AI không tự assign task.
Người dùng phải bấm chọn suggestion item để assign.
Mỗi suggestion chỉ nên chọn một item.
Khi đã chọn, suggestion status = SELECTED.
```

## 16.4 Employee Skill

```txt
Một employee không được có trùng skill.
years_experience >= 0.
proficiency phải thuộc BEGINNER / INTERMEDIATE / ADVANCED / EXPERT.
```

---

# 17. Thứ tự triển khai Phase 2

```txt
1. Cập nhật Prisma schema thêm 8 bảng Phase 2.
2. Tạo migration.
3. Seed skills mặc định.
4. Seed permissions Phase 2.
5. Cập nhật role_permissions cho ADMIN/MANAGER/EMPLOYEE.
6. Tạo Projects module.
7. Tạo Skills module.
8. Tạo Employee Skills module.
9. Tạo Tasks module.
10. Tạo Task Required Skills logic.
11. Tạo Task Assignments logic.
12. Mở rộng AccessControlService cho task/project/skill.
13. Tạo TaskWorkloadService.
14. Tạo TaskRecommendationService rule-based-v1.
15. Tạo AI Task Suggestions module.
16. Thêm audit log Phase 2.
17. Cập nhật Swagger.
18. Cập nhật frontend /admin Projects, Tasks, Skills, Employee Skills.
19. Cập nhật frontend /app Team Tasks, Assign Task, AI Suggestion.
20. Test manual assignment.
21. Test AI suggestion.
22. Test chọn gợi ý để assign task.
23. Test ABAC manager không giao task ngoài team.
```

---

# 18. Prompt giao cho Backend Coding Agent Phase 2

```txt
Hãy mở rộng backend CoreHR Phase 2 bằng NestJS + Prisma + PostgreSQL.

Mục tiêu:
- Thêm quản lý project, task, skill.
- Cho phép giao task thủ công.
- Cho phép nhờ AI/rule-based engine gợi ý nhân viên phù hợp để giao task.
- AI chỉ gợi ý, không tự động giao task.
- Manager/Admin phải chọn một gợi ý thì task mới được assign.

Yêu cầu:
1. Thêm các bảng:
   projects, tasks, skills, employee_skills, task_required_skills,
   task_assignments, ai_task_suggestions, ai_task_suggestion_items.

2. Thêm modules:
   projects, tasks, skills, employee-skills, task-assignments,
   ai-task-suggestions, task-workload.

3. Thêm permissions:
   PROJECT_CREATE, PROJECT_READ_ALL, PROJECT_READ_TEAM, PROJECT_UPDATE, PROJECT_DELETE,
   TASK_CREATE, TASK_READ_ALL, TASK_READ_TEAM, TASK_READ_SELF, TASK_UPDATE, TASK_DELETE,
   TASK_ASSIGN, TASK_UPDATE_STATUS,
   SKILL_CREATE, SKILL_READ, SKILL_UPDATE, SKILL_DELETE,
   EMPLOYEE_SKILL_CREATE, EMPLOYEE_SKILL_READ, EMPLOYEE_SKILL_UPDATE, EMPLOYEE_SKILL_DELETE,
   AI_TASK_SUGGEST, AI_TASK_SELECT, TASK_ASSIGNMENT_READ.

4. ADMIN toàn quyền.
5. MANAGER chỉ thao tác trong phạm vi cấp dưới qua employee_managers.
6. EMPLOYEE chỉ xem/cập nhật task của chính mình nếu được phép.
7. Manual assignment phải ghi task_assignments với assignment_type = MANUAL.
8. AI suggestion dùng rule-based-v1:
   final_score = skill_score * 0.60 + workload_score * 0.40.
9. Nếu có kiểm tra leave request thì dùng:
   final_score = skill_score * 0.50 + workload_score * 0.35 + availability_score * 0.15.
10. Lưu lịch sử suggestion vào ai_task_suggestions và ai_task_suggestion_items.
11. Khi chọn suggestion item:
   - update tasks.assignee_id
   - tạo task_assignments với assignment_type = AI_SUGGESTED
   - set selected = true
   - set suggestion status = SELECTED
   - ghi audit log.
12. Không thêm chatbot HRGenie ở Phase 2.
13. Không thêm ML phức tạp.
14. Không thêm performance/KPI nâng cao.
15. Cập nhật Swagger và seed data.
```

---

# 19. Prompt giao cho Frontend Coding Agent Phase 2

```txt
Hãy mở rộng frontend CoreHR Phase 2 bằng React + TypeScript + Vite + Mantine UI.

Yêu cầu:
- Giữ kiến trúc /admin và /app hiện tại.
- /admin chỉ ADMIN.
- /app dành cho MANAGER, ADMIN có thể vào.
- Dùng Mantine UI, giao diện mềm mại, bo góc.

Thêm /admin:
1. Projects
2. Tasks
3. Skills
4. Employee Skills
5. AI Task Suggestions

Thêm /app cho Manager:
1. Projects
2. Team Tasks
3. Assign Task
4. AI Task Suggestions

Task Management cần:
- Tạo task.
- Sửa task.
- Xóa mềm task.
- Lọc theo project/status/priority/assignee/deadline.
- Giao task thủ công.
- Nút "Nhờ AI gợi ý".
- Hiển thị danh sách gợi ý AI.
- Hiển thị score, skillScore, workloadScore, availabilityScore, reason.
- Nút "Chọn người này".
- Confirm modal trước khi assign.
- Loading/empty/error state.

Skill Management cần:
- CRUD skills.
- Gán skill cho employee.
- Sửa years_experience và proficiency.

AI Suggestion UI:
- Dùng Card bo góc cho từng suggestion item.
- Hiển thị rank, score, employee, reason.
- Có Badge/Progress để nhìn trực quan.
- Khi chọn suggestion, gọi API select và cập nhật task assignee.
```

---

# 20. Definition of Done Phase 2

## 20.1 Backend Done

```txt
1. Migration thêm 8 bảng Phase 2 chạy thành công.
2. Seed permissions Phase 2 chạy thành công.
3. Seed skills mặc định chạy thành công.
4. CRUD projects hoạt động.
5. CRUD skills hoạt động.
6. Gán skill cho employee hoạt động.
7. Tạo task hoạt động.
8. Thêm required skills cho task hoạt động.
9. Giao task thủ công hoạt động.
10. Ghi task_assignments khi giao task.
11. AI suggestion trả danh sách top employee phù hợp.
12. AI suggestion lưu vào database.
13. Chọn suggestion để assign task hoạt động.
14. Ghi audit log khi tạo task, assign task, generate suggestion, select suggestion.
15. MANAGER không giao được task cho employee ngoài team.
16. EMPLOYEE chỉ xem task của mình.
17. Swagger có API Phase 2.
```

## 20.2 Frontend Done

```txt
1. /admin có Projects.
2. /admin có Tasks.
3. /admin có Skills.
4. /admin có Employee Skills.
5. /admin có AI Task Suggestions.
6. /app có Team Tasks.
7. Manager tạo task cho team được.
8. Manager giao task thủ công được.
9. Manager bấm "Nhờ AI gợi ý" được.
10. Gợi ý AI hiển thị score và reason.
11. Manager chọn một gợi ý để assign task được.
12. MANAGER không thấy hoặc không thao tác được dữ liệu ngoài team.
13. UI Mantine mềm mại, bo góc, có loading/empty/error/confirm modal.
```

---

# 21. Ghi chú bảo vệ đồ án

Khi thuyết trình, có thể giải thích:

```txt
Phase 1 xây dựng nền tảng HRM lõi.
Phase 2 mở rộng sang quản lý công việc và nền tảng AI hỗ trợ giao task.

Điểm quan trọng là hệ thống không để AI tự quyết định hoàn toàn.
AI chỉ phân tích dữ liệu về kỹ năng, workload và trạng thái công việc để đưa ra gợi ý.
Người quản lý vẫn là người chọn nhân viên cuối cùng.

Cách làm này giúp hệ thống an toàn, dễ kiểm soát và phù hợp thực tế doanh nghiệp.
```

Có thể mô tả AI như sau:

```txt
AI Task Assignment Suggestion là module gợi ý người phù hợp để nhận task dựa trên:
- Kỹ năng của nhân viên
- Kỹ năng task yêu cầu
- Khối lượng công việc hiện tại
- Lịch nghỉ phép nếu có
- Deadline của task

Kết quả AI gồm danh sách ứng viên, điểm số và lý do gợi ý.
```

---

# 22. Kết luận

Phase 2 nên triển khai sau khi Phase 1 ổn định.

Bản gọn nhất cần làm:

```txt
projects
tasks
skills
employee_skills
task_required_skills
task_assignments
ai_task_suggestions
ai_task_suggestion_items
```

Không nên thêm chatbot, ML phức tạp, KPI nâng cao hoặc workflow phức tạp ngay trong Phase 2.

Hướng triển khai phù hợp nhất:

```txt
1. Giao task thủ công trước.
2. Có đủ dữ liệu skill và workload.
3. Thêm nút "Nhờ AI gợi ý".
4. AI trả top 3/top 5 ứng viên.
5. Manager/Admin chọn một ứng viên.
6. Hệ thống assign task và lưu lịch sử.
```
