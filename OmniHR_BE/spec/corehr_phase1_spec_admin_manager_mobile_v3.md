# CoreHR — Fullstack Specification Phase 1 v3

> Tài liệu dùng để giao trực tiếp cho coding agent triển khai hệ thống HRM phase 1.  
> Tên hệ thống gợi ý: **OmniHR**. Chatbot AI sau này có thể đặt tên là **HRGenie**.  
> Mục tiêu phase 1: xây dựng hệ thống quản lý nhân sự lõi, gồm backend, web quản lý và định hướng mobile app cho nhân viên.

---

## 1. Định hướng tổng quan

Hệ thống được chia thành 3 lớp sử dụng:

```txt
1. Web /app
   Dành cho MANAGER sử dụng hằng ngày để quản lý team.
   ADMIN cũng có thể truy cập nếu cần.

2. Web /admin
   Khu Quản trị hệ thống.
   Chỉ role ADMIN được truy cập.
   Trên giao diện /app, nếu user là ADMIN thì hiển thị nút "Quản trị hệ thống" để vào /admin.

3. Mobile App
   Dành cho EMPLOYEE thao tác hằng ngày.
   Nhân viên check-in/check-out, tạo đơn nghỉ, xem trạng thái đơn, xem hồ sơ cá nhân.
```

Phase 1 ưu tiên backend và web. Mobile app có thể làm phase sau, nhưng backend phải thiết kế sẵn API để mobile app dùng lại.

---

## 2. Quyết định scope mới

### 2.1 Role chính thức

Hệ thống chỉ dùng 3 role chính:

```txt
ADMIN
MANAGER
EMPLOYEE
```

Bỏ role:

```txt
HR_MANAGER
```

Lý do bỏ `HR_MANAGER`:

```txt
- Tránh hệ thống có quá nhiều role gây rối.
- ADMIN kiêm luôn chức năng quản lý nhân sự.
- MANAGER chỉ quản lý team/cấp dưới.
- EMPLOYEE chủ yếu dùng mobile app.
- Dễ code, dễ demo, dễ giải thích khi bảo vệ đồ án.
```

### 2.2 Tư duy phân quyền

```txt
ADMIN    = quản trị hệ thống + quản lý nhân sự toàn bộ.
MANAGER  = quản lý team/cấp dưới theo phạm vi ABAC.
EMPLOYEE = thao tác cá nhân trên mobile app.
```

---

## 3. Phạm vi phase 1

Phase 1 gồm:

```txt
Authentication
Authorization
RBAC
ABAC scope control
User management
Role management
Permission management
Policy management cơ bản
Department management
Position management
Employee management
Employee manager relationship
Attendance backend API
Leave request backend API
Leave type management
Audit log
Web /app cho Manager
Web /admin cho Admin
Docker development environment
Security baseline
Swagger API docs
```

Phase 1 chưa làm:

```txt
AI recommendation
Chatbot HRGenie
Payroll
KPI nâng cao
Performance review
Task recommendation
Workload balancing
Resource allocation request nâng cao
Complex workflow engine
Mobile app hoàn chỉnh nếu chưa đủ thời gian
```

---

## 4. Kiến trúc frontend

## 4.1 Route chính

```txt
/login
/app/*
/admin/*
```

Ý nghĩa:

```txt
/login    = màn hình đăng nhập.
/app/*    = màn hình làm việc chính cho MANAGER, ADMIN có thể vào.
/admin/*  = khu quản trị hệ thống, chỉ ADMIN được vào.
```

## 4.2 Rule truy cập route

```txt
/admin/*
- Chỉ ADMIN truy cập.
- MANAGER và EMPLOYEE nếu truy cập trực tiếp sẽ bị redirect hoặc hiển thị 403.

/app/*
- MANAGER truy cập để quản lý team.
- ADMIN truy cập được nếu cần.
- EMPLOYEE không ưu tiên dùng web, có thể redirect sang trang thông báo dùng mobile app.
```

## 4.3 Nút Quản trị hệ thống

Trong layout `/app`:

```txt
Nếu currentUser.roles includes ADMIN:
    Hiển thị nút "Quản trị hệ thống" ở header hoặc sidebar.
Nếu không phải ADMIN:
    Không hiển thị nút này.
```

Khi bấm:

```txt
Navigate tới /admin/dashboard
```

---

# 5. Chức năng Web /admin

Web Admin là khu vực quản trị hệ thống. Chỉ role `ADMIN` được truy cập.

## 5.1 Admin Dashboard

Hiển thị tổng quan:

```txt
Tổng số nhân viên
Tổng số phòng ban
Tổng số chức vụ
Tổng số user active
Số đơn nghỉ đang pending
Số bản ghi chấm công hôm nay
Hoạt động hệ thống gần đây
```

## 5.2 User Management

Chức năng:

```txt
Xem danh sách user
Tìm kiếm user theo username/email
Tạo user
Sửa user
Khóa/mở user
Reset mật khẩu nếu cần
Gán role cho user
Gỡ role khỏi user
Xem user đang gắn với employee nào
```

Không được:

```txt
Không xóa cứng user.
Không log password/token.
```

## 5.3 Role & Permission Management

Chức năng:

```txt
Xem danh sách role
Xem danh sách permission
Tạo/sửa role nếu backend hỗ trợ
Gán permission cho role
Gỡ permission khỏi role
Xem role đang được gán cho bao nhiêu user
```

Role seed mặc định:

```txt
ADMIN
MANAGER
EMPLOYEE
```

Permission seed mặc định được backend tạo sẵn, frontend chỉ cần hiển thị và gán.

## 5.4 Policy Management

Dùng để thể hiện phần ABAC.

Chức năng:

```txt
Xem danh sách policy
Xem condition JSON
Bật/tắt policy
Tạo/sửa policy nếu backend hỗ trợ
```

Phase 1 chưa cần policy builder phức tạp. Logic ABAC chính vẫn nằm trong `AccessControlService`.

## 5.5 Employee Management

Chức năng:

```txt
Xem toàn bộ nhân viên
Tìm kiếm theo tên, mã nhân viên, email
Lọc theo phòng ban, chức vụ, trạng thái
Tạo nhân viên và tự động tạo tài khoản đăng nhập
Sửa nhân viên
Xem chi tiết nhân viên
Xóa mềm nhân viên
Khóa/mở tài khoản đăng nhập của nhân viên nếu cần
Reset mật khẩu mặc định cho nhân viên nếu cần
```

### 5.5.1 Tự động tạo tài khoản khi tạo employee

Khi ADMIN tạo employee mới, backend phải tạo luôn user account tương ứng cho employee đó.

Quy tắc tạo tài khoản:

```txt
username = company_email
email = company_email
default password = ngày sinh của nhân viên theo định dạng ddMMyyyy
role mặc định = EMPLOYEE
users.must_change_password = true
employees.user_id = users.id
```

Ví dụ:

```txt
Employee birth_date = 2001-09-05
Default password = 05092001
Company email = nguyen.van.a@company.com
Username/email đăng nhập = nguyen.van.a@company.com
```

Luồng xử lý khi tạo employee:

```txt
1. ADMIN nhập thông tin employee trên Web Admin.
2. ADMIN bắt buộc nhập company_email và birth_date.
3. Backend validate company_email chưa tồn tại trong employees và users.
4. Backend tạo user với username/email = company_email.
5. Backend tạo default password từ birth_date theo format ddMMyyyy.
6. Backend hash password bằng bcrypt, không lưu plain text.
7. Backend gán role EMPLOYEE cho user mới.
8. Backend tạo employee và gắn employees.user_id = users.id.
9. Backend set users.must_change_password = true để bắt nhân viên đổi mật khẩu lần đầu.
10. Backend ghi audit log CREATE_EMPLOYEE và CREATE_USER_FOR_EMPLOYEE.
```

Yêu cầu bảo mật:

```txt
Không log mật khẩu mặc định vào audit log.
Không trả password_hash ra response.
Response có thể trả defaultPassword một lần cho ADMIN xem nếu chưa có email service.
Nếu có email service, backend gửi thông tin đăng nhập qua email công ty.
Khi user đăng nhập lần đầu với mật khẩu mặc định, backend phải yêu cầu đổi mật khẩu trước khi dùng chức năng chính.
Không cho tạo employee nếu thiếu birth_date vì không tạo được password ddMMyyyy.
Không cho tạo employee nếu company_email đã tồn tại trong users hoặc employees.
```

Response tạo employee gợi ý:

```json
{
  "success": true,
  "message": "Employee and system account created successfully",
  "data": {
    "employeeId": 1,
    "userId": 10,
    "employeeCode": "EMP001",
    "fullName": "Nguyễn Văn A",
    "companyEmail": "nguyen.van.a@company.com",
    "username": "nguyen.van.a@company.com",
    "defaultPassword": "05092001",
    "mustChangePassword": true
  }
}
```

### 5.5.2 Reset mật khẩu nhân viên

Web Admin nên có nút hành động:

```txt
Reset mật khẩu
```

Khi ADMIN reset mật khẩu, backend đặt lại mật khẩu về ngày sinh `ddMMyyyy`, set `must_change_password = true`, thu hồi refresh token hiện tại của user và ghi audit log `RESET_EMPLOYEE_PASSWORD`.

## 5.6 Department Management

Chức năng:

```txt
Xem danh sách phòng ban
Xem cây phòng ban
Tạo phòng ban
Sửa phòng ban
Xóa mềm phòng ban
Gán phòng ban cha nếu có
```

## 5.7 Position Management

Chức năng:

```txt
Xem danh sách chức vụ
Tạo chức vụ
Sửa chức vụ
Xóa mềm chức vụ
Quản lý level chức vụ nếu có
```

## 5.8 Manager Relationship Management

Chức năng:

```txt
Xem manager của một nhân viên
Xem danh sách cấp dưới của một manager
Gán direct manager
Gán project manager nếu cần
Kết thúc quan hệ quản lý
Không cho nhân viên tự quản lý chính mình
```

## 5.9 Attendance Management

Admin quản lý dữ liệu chấm công toàn hệ thống.

Chức năng:

```txt
Xem toàn bộ bản ghi chấm công
Lọc theo nhân viên, phòng ban, ngày, loại bản ghi
Xem lịch sử chấm công của một nhân viên
Điều chỉnh dữ liệu nếu backend cho phép
```

Lưu ý:

```txt
Web admin không phải nơi nhân viên tự check-in/check-out.
API check-in/check-out vẫn giữ để mobile app dùng.
```

## 5.10 Leave Type Management

Chức năng:

```txt
Xem danh sách loại nghỉ
Tạo loại nghỉ
Sửa loại nghỉ
Bật/tắt loại nghỉ
Cấu hình số ngày tối đa mỗi năm nếu cần
```

## 5.11 Leave Request Management

Admin xem và xử lý toàn bộ đơn nghỉ.

Chức năng:

```txt
Xem toàn bộ đơn nghỉ
Lọc theo trạng thái, phòng ban, nhân viên, loại nghỉ, khoảng ngày
Xem chi tiết đơn
Duyệt đơn nếu cần
Từ chối đơn nếu cần
Xem lý do nghỉ, lý do từ chối, người duyệt, thời gian duyệt
```

## 5.12 Audit Log

Chức năng:

```txt
Xem lịch sử thao tác hệ thống
Lọc theo user, action, entity type, thời gian
Xem old_value và new_value
```

Chỉ ADMIN được xem.

## 5.13 System Settings

Chức năng gợi ý:

```txt
Xem cấu hình hệ thống
Cấu hình rule nghỉ phép cơ bản nếu có
Cấu hình CORS/API URL ở mức frontend env nếu cần
```

Phase 1 có thể làm đơn giản hoặc để placeholder.

## 5.14 Menu Web Admin

```txt
Dashboard
Employees
Departments
Positions
Managers
Attendance
Leave Requests
Leave Types
Users
Roles & Permissions
Policies
Audit Logs
System Settings
```

---

# 6. Chức năng Web /app cho Manager

Web `/app` là trang làm việc thường ngày cho `MANAGER`. `ADMIN` có thể vào nếu cần.

## 6.1 Manager Dashboard

Hiển thị:

```txt
Tổng số nhân viên cấp dưới
Số đơn nghỉ pending của team
Tình hình chấm công hôm nay của team
Danh sách đơn nghỉ mới nhất của cấp dưới
Danh sách cấp dưới mới nhất hoặc quan trọng
```

## 6.2 My Team

Chức năng:

```txt
Xem danh sách cấp dưới
Tìm kiếm cấp dưới theo tên/email/mã nhân viên
Xem chi tiết thông tin cơ bản của cấp dưới
Xem phòng ban, chức vụ, trạng thái làm việc
```

MANAGER chỉ xem được nhân viên thuộc phạm vi quản lý theo bảng `employee_managers`.

## 6.3 Team Attendance

Chức năng:

```txt
Xem chấm công của cấp dưới
Lọc theo nhân viên, ngày, loại bản ghi
Xem lịch sử chấm công của từng cấp dưới
```

MANAGER không xem được attendance của nhân viên không thuộc cấp dưới.

## 6.4 Team Leave Requests

Chức năng:

```txt
Xem đơn nghỉ của cấp dưới
Lọc theo trạng thái, nhân viên, loại nghỉ, khoảng ngày
Xem chi tiết đơn
Duyệt đơn pending
Từ chối đơn pending kèm lý do
```

Rule:

```txt
MANAGER chỉ duyệt đơn của cấp dưới.
MANAGER không được tự duyệt đơn của chính mình.
Chỉ approve/reject đơn có status = PENDING.
```

## 6.5 My Profile

Chức năng:

```txt
Xem hồ sơ cá nhân của manager
Xem phòng ban/chức vụ của mình
Xem manager của mình nếu có
Đổi mật khẩu nếu backend hỗ trợ
```

## 6.6 Menu Web /app

```txt
Dashboard
My Team
Team Attendance
Team Leave Requests
My Profile
```

Nếu user là ADMIN, hiển thị thêm:

```txt
Quản trị hệ thống
```

---

# 7. Mobile App cho Employee

Mobile app có thể làm phase sau, nhưng backend phải support API.

## 7.1 Chức năng Employee trên Mobile App

```txt
Đăng nhập
Xem hồ sơ cá nhân
Xem manager trực tiếp
Xem phòng ban/chức vụ
Check-in
Check-out
Xem lịch sử chấm công cá nhân
Tạo đơn xin nghỉ
Xem danh sách đơn nghỉ của mình
Xem trạng thái đơn nghỉ
Hủy đơn nghỉ khi status = PENDING
Đổi mật khẩu nếu backend hỗ trợ
```

## 7.2 Employee trên Web

EMPLOYEE không ưu tiên dùng web.

Nếu EMPLOYEE đăng nhập web:

```txt
Có thể redirect tới trang thông báo:
"Tài khoản nhân viên vui lòng sử dụng ứng dụng mobile để thao tác."
```

Hoặc chỉ cho xem My Profile nếu muốn demo thêm, nhưng không bắt buộc.

---

# 8. Tech stack bắt buộc

## 8.1 Backend

```txt
NestJS
TypeScript
PostgreSQL
Prisma ORM
JWT Access Token + Refresh Token
bcrypt
class-validator
class-transformer
Swagger / OpenAPI
Helmet
NestJS Throttler
Redis nếu cần rate limit/cache
Docker
Docker Compose
```

## 8.2 Frontend Web

```txt
React
TypeScript
Vite
Mantine UI
React Router
TanStack Query
Axios
Zustand hoặc Redux Toolkit cho auth state
Zod/Yup nếu cần validate form
Mantine Notifications
```

## 8.3 Mobile App phase sau

Gợi ý:

```txt
React Native hoặc Flutter
Dùng lại API backend
Login bằng JWT
Refresh token rotation
```

---

# 9. UI/UX Web Requirements

Frontend web bắt buộc dùng Mantine UI.

Phong cách:

```txt
Mềm mại
Hiện đại
Gọn gàng
Bo góc rõ ràng
Không cứng như admin template cũ
Spacing thoáng
Màu sắc nhẹ, chuyên nghiệp
```

Yêu cầu cụ thể:

```txt
Card bo góc
Modal bo góc
Input bo góc
Button bo góc
Table wrapper bo góc
Filter box bo góc
Dropdown/action menu bo góc
Confirm modal cho thao tác nguy hiểm
Loading state rõ ràng
Empty state rõ ràng
Error state rõ ràng
```

Mantine theme gợi ý:

```ts
const theme = createTheme({
  primaryColor: "blue",
  defaultRadius: "lg",
  fontFamily: "Inter, sans-serif",
  components: {
    Button: {
      defaultProps: {
        radius: "lg",
      },
    },
    Card: {
      defaultProps: {
        radius: "lg",
        withBorder: true,
      },
    },
    Modal: {
      defaultProps: {
        radius: "lg",
        centered: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: "md",
      },
    },
    Select: {
      defaultProps: {
        radius: "md",
      },
    },
  },
});
```

---

# 10. Frontend folder structure

```txt
src/
 ├── app/
 │    ├── App.tsx
 │    └── providers.tsx
 ├── api/
 │    ├── axios.ts
 │    └── endpoints.ts
 ├── components/
 │    ├── DataTable/
 │    ├── ConfirmModal/
 │    ├── PageHeader/
 │    ├── PermissionGate/
 │    └── EmptyState/
 ├── layouts/
 │    ├── AppLayout.tsx
 │    └── AdminLayout.tsx
 ├── features/
 │    ├── auth/
 │    ├── app-dashboard/
 │    ├── admin-dashboard/
 │    ├── employees/
 │    ├── departments/
 │    ├── positions/
 │    ├── managers/
 │    ├── attendance/
 │    ├── leave-requests/
 │    ├── leave-types/
 │    ├── users/
 │    ├── roles-permissions/
 │    ├── policies/
 │    └── audit-logs/
 ├── hooks/
 ├── routes/
 │    ├── AppRoutes.tsx
 │    ├── AdminRoutes.tsx
 │    ├── RequireAuth.tsx
 │    ├── RequireAdmin.tsx
 │    └── RequireRole.tsx
 ├── stores/
 │    └── auth.store.ts
 ├── theme/
 │    └── theme.ts
 ├── types/
 └── utils/
```

---

# 11. Backend folder structure

```txt
src/
 ├── main.ts
 ├── app.module.ts
 ├── config/
 ├── prisma/
 ├── auth/
 ├── users/
 ├── roles/
 ├── permissions/
 ├── policies/
 ├── departments/
 ├── positions/
 ├── employees/
 ├── employee-managers/
 ├── attendance/
 ├── leave-types/
 ├── leave-requests/
 ├── audit-logs/
 └── common/
      ├── decorators/
      ├── guards/
      ├── interceptors/
      ├── filters/
      ├── services/
      │    └── access-control.service.ts
      ├── constants/
      ├── enums/
      └── utils/
```

---

# 12. Database Design tổng quan

Tổng bảng phase 1:

```txt
1. users
2. roles
3. permissions
4. user_roles
5. role_permissions
6. policies
7. departments
8. positions
9. employees
10. employee_managers
11. attendance_records
12. leave_types
13. leave_requests
14. audit_logs
```

---

# 13. Database tables chi tiết

## 13.1 users

```sql
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    must_change_password BOOLEAN DEFAULT TRUE,
    refresh_token_hash TEXT,
    refresh_token_family VARCHAR(100),
    refresh_token_version INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

Ghi chú:

```txt
must_change_password = true khi user mới được tạo từ employee hoặc khi ADMIN reset mật khẩu.
User có must_change_password = true chỉ được gọi /auth/change-password, chưa được dùng các chức năng chính.
```

## 13.2 roles

```sql
CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Seed:

```txt
ADMIN
MANAGER
EMPLOYEE
```

## 13.3 permissions

```sql
CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    module VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 13.4 user_roles

```sql
CREATE TABLE user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id),
    role_id BIGINT NOT NULL REFERENCES roles(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);
```

## 13.5 role_permissions

```sql
CREATE TABLE role_permissions (
    role_id BIGINT NOT NULL REFERENCES roles(id),
    permission_id BIGINT NOT NULL REFERENCES permissions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, permission_id)
);
```

## 13.6 policies

```sql
CREATE TABLE policies (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    effect VARCHAR(20) NOT NULL CHECK (effect IN ('ALLOW', 'DENY')),
    condition JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 13.7 departments

```sql
CREATE TABLE departments (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES departments(id),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

## 13.8 positions

```sql
CREATE TABLE positions (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    level VARCHAR(50),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

## 13.9 employees

```sql
CREATE TABLE employees (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE REFERENCES users(id),
    department_id BIGINT REFERENCES departments(id),
    position_id BIGINT REFERENCES positions(id),
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    company_email VARCHAR(255) UNIQUE NOT NULL,
    personal_email VARCHAR(255),
    phone VARCHAR(20),
    avatar_url TEXT,
    gender VARCHAR(20) CHECK (gender IN ('MALE', 'FEMALE', 'OTHER')),
    birth_date DATE,
    address TEXT,
    hire_date DATE NOT NULL,
    employment_type VARCHAR(50) CHECK (employment_type IN ('FULLTIME', 'PARTTIME', 'INTERN', 'CONTRACT')),
    status VARCHAR(50) DEFAULT 'WORKING' CHECK (status IN ('WORKING', 'PROBATION', 'RESIGNED', 'SUSPENDED')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
```

## 13.10 employee_managers

```sql
CREATE TABLE employee_managers (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    manager_id BIGINT NOT NULL REFERENCES employees(id),
    relation_type VARCHAR(50) NOT NULL CHECK (relation_type IN ('DIRECT', 'PROJECT', 'FUNCTIONAL')),
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT no_self_manager CHECK (employee_id <> manager_id)
);
```

Rule:

```txt
Một employee nên có tối đa 1 DIRECT manager active.
Một manager có thể quản lý nhiều employee.
Một employee có thể có nhiều PROJECT/FUNCTIONAL manager nếu cần.
```

## 13.11 attendance_records

```sql
CREATE TABLE attendance_records (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    type VARCHAR(50) NOT NULL CHECK (type IN ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END')),
    recorded_at TIMESTAMP NOT NULL,
    work_date DATE NOT NULL,
    source VARCHAR(50) DEFAULT 'WEB' CHECK (source IN ('WEB', 'MOBILE', 'ADMIN')),
    note TEXT,
    created_by BIGINT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 13.12 leave_types

```sql
CREATE TABLE leave_types (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_paid BOOLEAN DEFAULT TRUE,
    max_days_per_year INT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 13.13 leave_requests

```sql
CREATE TABLE leave_requests (
    id BIGSERIAL PRIMARY KEY,
    employee_id BIGINT NOT NULL REFERENCES employees(id),
    leave_type_id BIGINT NOT NULL REFERENCES leave_types(id),
    approver_id BIGINT REFERENCES employees(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days NUMERIC(5,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    reject_reason TEXT,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_leave_dates CHECK (end_date >= start_date)
);
```

## 13.14 audit_logs

```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id BIGINT,
    old_value JSONB,
    new_value JSONB,
    description TEXT,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

# 14. RBAC + ABAC Design

## 14.1 RBAC

RBAC kiểm tra user có quyền thực hiện hành động không.

Ví dụ:

```txt
EMPLOYEE_READ_ALL
EMPLOYEE_READ_TEAM
LEAVE_APPROVE
ATTENDANCE_READ_TEAM
USER_CREATE
ROLE_ASSIGN
```

## 14.2 ABAC

ABAC kiểm tra user được thao tác trên dữ liệu nào.

Ví dụ:

```txt
MANAGER có LEAVE_APPROVE nhưng chỉ được approve leave của cấp dưới.
EMPLOYEE chỉ xem attendance của chính mình.
ADMIN được truy cập toàn bộ.
```

## 14.3 AccessControlService bắt buộc có

File:

```txt
src/common/services/access-control.service.ts
```

Hàm cần có:

```ts
canReadEmployee(currentUser, targetEmployeeId): Promise<boolean>
canUpdateEmployee(currentUser, targetEmployeeId): Promise<boolean>
canReadAttendance(currentUser, employeeId): Promise<boolean>
canReadLeaveRequest(currentUser, leaveRequestId): Promise<boolean>
canApproveLeaveRequest(currentUser, leaveRequestId): Promise<boolean>
isSubordinate(managerEmployeeId, employeeId): Promise<boolean>
isAdmin(currentUser): boolean
isManager(currentUser): boolean
isEmployee(currentUser): boolean
```

## 14.4 Guard flow

```txt
Request
 → JwtAuthGuard
 → PermissionsGuard
 → AccessControlService / PoliciesGuard
 → Controller
 → Service
```

---

# 15. Permission Matrix

## 15.1 ADMIN

ADMIN có toàn quyền.

```txt
USER_CREATE
USER_READ
USER_UPDATE
USER_DELETE
ROLE_CREATE
ROLE_READ
ROLE_UPDATE
ROLE_DELETE
ROLE_ASSIGN
PERMISSION_READ
PERMISSION_ASSIGN
POLICY_CREATE
POLICY_READ
POLICY_UPDATE
POLICY_DELETE
EMPLOYEE_CREATE
EMPLOYEE_READ_ALL
EMPLOYEE_UPDATE_ALL
EMPLOYEE_DELETE
DEPARTMENT_CREATE
DEPARTMENT_READ
DEPARTMENT_UPDATE
DEPARTMENT_DELETE
POSITION_CREATE
POSITION_READ
POSITION_UPDATE
POSITION_DELETE
MANAGER_ASSIGN
MANAGER_READ
MANAGER_REMOVE
ATTENDANCE_READ_ALL
ATTENDANCE_ADJUST
LEAVE_TYPE_CREATE
LEAVE_TYPE_READ
LEAVE_TYPE_UPDATE
LEAVE_TYPE_DELETE
LEAVE_READ_ALL
LEAVE_APPROVE
LEAVE_REJECT
AUDIT_LOG_READ
SYSTEM_SETTING_READ
SYSTEM_SETTING_UPDATE
```

## 15.2 MANAGER

```txt
EMPLOYEE_READ_TEAM
ATTENDANCE_READ_TEAM
LEAVE_READ_TEAM
LEAVE_APPROVE
LEAVE_REJECT
EMPLOYEE_READ_SELF
ATTENDANCE_READ_SELF
LEAVE_READ_SELF
```

ABAC:

```txt
Chỉ xem nhân viên là cấp dưới trong employee_managers.
Chỉ xem attendance của cấp dưới.
Chỉ duyệt/reject leave request của cấp dưới.
Không tự approve leave của chính mình.
```

## 15.3 EMPLOYEE

```txt
EMPLOYEE_READ_SELF
EMPLOYEE_UPDATE_SELF
ATTENDANCE_CHECK_IN
ATTENDANCE_CHECK_OUT
ATTENDANCE_READ_SELF
LEAVE_CREATE
LEAVE_READ_SELF
LEAVE_CANCEL_SELF
```

ABAC:

```txt
Chỉ xem/sửa profile của chính mình.
Chỉ check-in/check-out cho chính mình.
Chỉ xem attendance của chính mình.
Chỉ tạo/cancel leave của chính mình.
```

---

# 16. API Design

## 16.1 Auth API

```http
POST /auth/login
POST /auth/refresh
POST /auth/logout
GET /auth/me
POST /auth/change-password
```

## 16.2 Users API

```http
GET /users
GET /users/:id
POST /users
PATCH /users/:id
DELETE /users/:id
POST /users/:id/roles
DELETE /users/:id/roles/:roleId
```

Chỉ ADMIN.

## 16.3 Roles API

```http
GET /roles
GET /roles/:id
POST /roles
PATCH /roles/:id
DELETE /roles/:id
POST /roles/:id/permissions
DELETE /roles/:id/permissions/:permissionId
```

Chỉ ADMIN.

## 16.4 Permissions API

```http
GET /permissions
GET /permissions/:id
```

Chỉ ADMIN.

## 16.5 Policies API

```http
GET /policies
GET /policies/:id
POST /policies
PATCH /policies/:id
DELETE /policies/:id
```

Chỉ ADMIN.

## 16.6 Departments API

```http
GET /departments
GET /departments/tree
GET /departments/:id
POST /departments
PATCH /departments/:id
DELETE /departments/:id
```

ADMIN quản lý. MANAGER có thể read nếu cần hiển thị thông tin team.

## 16.7 Positions API

```http
GET /positions
GET /positions/:id
POST /positions
PATCH /positions/:id
DELETE /positions/:id
```

ADMIN quản lý. MANAGER có thể read nếu cần.

## 16.8 Employees API

```http
GET /employees
GET /employees/me
GET /employees/team
GET /employees/:id
POST /employees
PATCH /employees/:id
DELETE /employees/:id
POST /employees/:id/reset-password
```

Rule:

```txt
ADMIN xem/tạo/sửa/xóa mềm toàn bộ.
MANAGER chỉ xem team qua /employees/team hoặc detail cấp dưới.
EMPLOYEE chỉ xem/sửa profile của chính mình.
```

## 16.9 Employee Managers API

```http
GET /employees/:id/managers
GET /employees/:id/subordinates
POST /employees/:id/managers
PATCH /employee-managers/:id
DELETE /employee-managers/:id
```

Admin quản lý. Manager có thể xem cấp dưới của mình.

## 16.10 Attendance API

```http
POST /attendance/check-in
POST /attendance/check-out
GET /attendance/me
GET /attendance/team
GET /attendance
```

Rule:

```txt
EMPLOYEE dùng mobile app gọi check-in/check-out.
MANAGER xem /attendance/team.
ADMIN xem /attendance toàn bộ.
```

## 16.11 Leave Types API

```http
GET /leave-types
GET /leave-types/:id
POST /leave-types
PATCH /leave-types/:id
DELETE /leave-types/:id
```

ADMIN quản lý.

## 16.12 Leave Requests API

```http
POST /leave-requests
GET /leave-requests/me
GET /leave-requests/team
GET /leave-requests
GET /leave-requests/:id
PATCH /leave-requests/:id/approve
PATCH /leave-requests/:id/reject
PATCH /leave-requests/:id/cancel
```

Rule:

```txt
EMPLOYEE dùng mobile app tạo/cancel/xem đơn của mình.
MANAGER xem/dụyệt/từ chối đơn của cấp dưới.
ADMIN xem/xử lý toàn bộ.
```

## 16.13 Audit Logs API

```http
GET /audit-logs
GET /audit-logs/:id
```

Chỉ ADMIN.

---

# 17. Business Rules

## 17.1 Employee

```txt
employee_code unique.
company_email unique.
Khi tạo employee mới, backend phải tạo luôn user account tương ứng.
company_email được dùng làm username/email đăng nhập.
Mật khẩu mặc định là ngày sinh theo định dạng ddMMyyyy.
Một user chỉ gắn với tối đa một employee.
Employee mới bắt buộc có birth_date để tạo mật khẩu mặc định.
User mới phải có must_change_password = true.
Soft delete employee, không hard delete.
Không xóa department nếu còn employee active.
Không xóa position nếu còn employee active.
```

## 17.2 Manager relationship

```txt
Không cho employee tự làm manager của chính mình.
Một employee nên có tối đa 1 DIRECT manager active.
Một manager có thể quản lý nhiều employee.
Manager chỉ xem/dụyệt dữ liệu của cấp dưới active.
```

## 17.3 Attendance

```txt
CHECK_OUT không được xuất hiện nếu chưa có CHECK_IN cùng ngày.
Không cho CHECK_IN liên tiếp nếu chưa CHECK_OUT.
Không cho CHECK_OUT liên tiếp.
Employee chỉ check-in/check-out cho chính mình.
Manager chỉ xem attendance của cấp dưới.
Admin xem toàn bộ attendance.
```

### 17.3.1 Ràng buộc check-in/check-out bắt buộc

Backend phải kiểm tra trạng thái chấm công trong ngày trước khi tạo record mới.

Trường hợp nhân viên quên check-in buổi sáng nhưng chiều bấm check-out:

```txt
Không tự động tạo CHECK_IN giả.
Không cho tạo CHECK_OUT.
Backend phải trả lỗi rõ ràng để nhân viên báo ADMIN điều chỉnh.
```

Response lỗi bắt buộc:

```json
{
  "success": false,
  "message": "Bạn chưa check-in hôm nay nên không thể check-out. Vui lòng báo Admin để được điều chỉnh chấm công.",
  "errorCode": "ATTENDANCE_INVALID_ACTION"
}
```

Các case lỗi khác cũng dùng `ATTENDANCE_INVALID_ACTION`:

```txt
CHECK_IN liên tiếp khi chưa CHECK_OUT.
CHECK_OUT liên tiếp.
CHECK_OUT khi chưa có CHECK_IN trong cùng work_date.
Employee check-in/check-out hộ người khác.
```

### 17.3.2 Điều chỉnh chấm công bởi ADMIN

Vì nhân viên có thể quên check-in/check-out, Web Admin cần có chức năng điều chỉnh dữ liệu chấm công nếu backend cho phép.

Rule:

```txt
Chỉ ADMIN được tạo/sửa bản ghi điều chỉnh chấm công.
Mọi điều chỉnh phải có note/reason.
Mọi điều chỉnh phải ghi audit log.
Không hard delete attendance record; nếu cần hủy thì đánh dấu hoặc tạo bản ghi điều chỉnh.
```

Action audit log gợi ý:

```txt
ATTENDANCE_ADJUST
ATTENDANCE_ADMIN_CREATE
ATTENDANCE_ADMIN_UPDATE
```

## 17.4 Leave Request

```txt
start_date <= end_date.
total_days bắt buộc do backend tự tính, frontend không được tin cậy giá trị này từ client.
Không tạo leave request trùng ngày với đơn PENDING hoặc APPROVED.
Không approve đơn không phải cấp dưới, trừ ADMIN.
Không tự duyệt đơn của mình.
Không reject nếu đơn không ở trạng thái PENDING.
Không cancel nếu đơn đã APPROVED hoặc REJECTED.
Employee chỉ được cancel đơn của mình khi status = PENDING.
```

### 17.4.1 Tính số ngày nghỉ `total_days` ở backend

Backend phải tự tính `total_days` dựa trên `start_date` và `end_date`. Client không được tự gửi hoặc nếu có gửi thì backend phải bỏ qua.

Rule mặc định phase 1:

```txt
Công ty làm việc từ thứ 2 đến thứ 6.
Thứ 7 và Chủ nhật không tính vào total_days.
start_date và end_date được tính inclusive.
Nếu khoảng nghỉ chỉ rơi vào thứ 7/Chủ nhật thì total_days = 0 và backend phải từ chối tạo đơn.
```

Ví dụ:

```txt
Thứ 2 đến Thứ 6: total_days = 5.
Thứ 6 đến Thứ 2: total_days = 2, vì bỏ Thứ 7 và Chủ nhật.
Thứ 7 đến Chủ nhật: total_days = 0, không hợp lệ.
```

Pseudo logic:

```ts
function calculateLeaveDays(startDate: Date, endDate: Date): number {
  let total = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    const day = current.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = day === 0 || day === 6;

    if (!isWeekend) {
      total += 1;
    }

    current.setDate(current.getDate() + 1);
  }

  return total;
}
```

Error khi số ngày nghỉ không hợp lệ:

```json
{
  "success": false,
  "message": "Khoảng ngày nghỉ không có ngày làm việc hợp lệ. Vui lòng chọn ngày từ thứ 2 đến thứ 6.",
  "errorCode": "LEAVE_REQUEST_INVALID_DAYS"
}
```

Ghi chú mở rộng phase sau:

```txt
Nếu công ty có lịch làm việc riêng hoặc ngày nghỉ lễ, có thể thêm bảng work_calendar/holidays/system_settings.
Phase 1 chỉ cần rule mặc định thứ 2 - thứ 6 để tránh over-engineering.
```

---

# 18. Refresh Token Security

Bắt buộc có:

```txt
Refresh Token Hashing
Refresh Token Rotation
Refresh Token Reuse Detection
Logout thu hồi refresh token
```

Luồng refresh:

```txt
1. Client gửi refreshToken hiện tại.
2. Backend verify token.
3. Backend lấy user từ token payload.
4. So sánh refreshToken client gửi với refresh_token_hash trong DB.
5. Nếu hợp lệ:
   - Tạo accessToken mới.
   - Tạo refreshToken mới.
   - Hash refreshToken mới.
   - Ghi đè refresh_token_hash cũ trong DB.
   - Tăng refresh_token_version.
   - Trả token mới cho client.
6. Refresh token cũ không còn dùng được nữa.
7. Nếu token không khớp hash hiện tại, coi là reuse, xóa refresh_token_hash và buộc đăng nhập lại.
```

---

# 19. Security baseline

Backend bắt buộc:

```txt
Dùng Prisma ORM, không nối chuỗi SQL thủ công.
Không dùng $queryRawUnsafe hoặc $executeRawUnsafe với input người dùng.
Bật ValidationPipe whitelist, forbidNonWhitelisted, transform.
DTO validate đầy đủ độ dài, enum, email, date.
Sanitize text input: trim, giới hạn độ dài, không lưu script/html.
Bật helmet.
CORS đọc từ env, không mở * trong production.
Rate limit login/refresh.
Hash password bằng bcrypt hoặc argon2.
Hash refresh token.
Không log password/access token/refresh token.
.env không commit.
Swagger bật cho dev.
Audit log các thao tác quan trọng.
```

Frontend bắt buộc:

```txt
Không lưu access token ở nơi dễ bị lộ nếu có thể.
Axios interceptor gắn access token.
Có refresh token flow.
Khi backend trả 401 thì refresh hoặc logout.
Khi backend trả 403 thì hiển thị không có quyền.
Ẩn menu/button theo role/permission nhưng không coi đó là bảo mật chính.
Escape dữ liệu khi render.
Không render raw HTML từ backend.
```

---

# 20. Response format

Success:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "message": "Employee not found",
  "errorCode": "EMPLOYEE_NOT_FOUND"
}
```

---

# 21. Error Codes

```txt
UNAUTHORIZED
FORBIDDEN
VALIDATION_ERROR
USER_NOT_FOUND
USER_INACTIVE
INVALID_CREDENTIALS
INVALID_REFRESH_TOKEN
REFRESH_TOKEN_REUSED
ROLE_NOT_FOUND
PERMISSION_NOT_FOUND
POLICY_NOT_FOUND
EMPLOYEE_NOT_FOUND
DEPARTMENT_NOT_FOUND
POSITION_NOT_FOUND
ATTENDANCE_INVALID_ACTION
LEAVE_TYPE_NOT_FOUND
LEAVE_REQUEST_NOT_FOUND
LEAVE_REQUEST_INVALID_STATUS
LEAVE_REQUEST_OVERLAP
LEAVE_REQUEST_INVALID_DAYS
POLICY_DENIED
ADMIN_ONLY_ROUTE
MANAGER_SCOPE_DENIED
```

---

# 22. Seed Data

## 22.1 Roles

```txt
ADMIN
MANAGER
EMPLOYEE
```

Không seed `HR_MANAGER`.

## 22.2 Leave Types

```txt
ANNUAL_LEAVE
SICK_LEAVE
UNPAID_LEAVE
MATERNITY_LEAVE
MARRIAGE_LEAVE
BEREAVEMENT_LEAVE
```

## 22.3 Permissions

```txt
USER_CREATE
USER_READ
USER_UPDATE
USER_DELETE
ROLE_CREATE
ROLE_READ
ROLE_UPDATE
ROLE_DELETE
ROLE_ASSIGN
PERMISSION_READ
PERMISSION_ASSIGN
POLICY_CREATE
POLICY_READ
POLICY_UPDATE
POLICY_DELETE
EMPLOYEE_CREATE
EMPLOYEE_READ_ALL
EMPLOYEE_READ_TEAM
EMPLOYEE_READ_SELF
EMPLOYEE_UPDATE_ALL
EMPLOYEE_UPDATE_SELF
EMPLOYEE_DELETE
DEPARTMENT_CREATE
DEPARTMENT_READ
DEPARTMENT_UPDATE
DEPARTMENT_DELETE
POSITION_CREATE
POSITION_READ
POSITION_UPDATE
POSITION_DELETE
MANAGER_ASSIGN
MANAGER_READ
MANAGER_REMOVE
ATTENDANCE_CHECK_IN
ATTENDANCE_CHECK_OUT
ATTENDANCE_READ_ALL
ATTENDANCE_READ_TEAM
ATTENDANCE_READ_SELF
ATTENDANCE_ADJUST
LEAVE_TYPE_CREATE
LEAVE_TYPE_READ
LEAVE_TYPE_UPDATE
LEAVE_TYPE_DELETE
LEAVE_CREATE
LEAVE_READ_ALL
LEAVE_READ_TEAM
LEAVE_READ_SELF
LEAVE_APPROVE
LEAVE_REJECT
LEAVE_CANCEL_SELF
AUDIT_LOG_READ
SYSTEM_SETTING_READ
SYSTEM_SETTING_UPDATE
```

## 22.4 Admin User

Seed admin user từ biến môi trường:

```txt
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_EMAIL
DEFAULT_ADMIN_PASSWORD
```

Admin phải được gán role `ADMIN`.

---

# 23. Audit Log Requirements

Các thao tác phải ghi audit log:

```txt
CREATE_USER
UPDATE_USER
DELETE_USER
ASSIGN_ROLE
REMOVE_ROLE
CREATE_EMPLOYEE
UPDATE_EMPLOYEE
DELETE_EMPLOYEE
CREATE_DEPARTMENT
UPDATE_DEPARTMENT
DELETE_DEPARTMENT
CREATE_POSITION
UPDATE_POSITION
DELETE_POSITION
ASSIGN_MANAGER
REMOVE_MANAGER
CHECK_IN
CHECK_OUT
CREATE_LEAVE_REQUEST
APPROVE_LEAVE_REQUEST
REJECT_LEAVE_REQUEST
CANCEL_LEAVE_REQUEST
LOGIN
LOGOUT
REFRESH_TOKEN_REUSE_DETECTED
```

Audit log lưu:

```txt
user_id
action
entity_type
entity_id
old_value
new_value
ip_address
user_agent
created_at
```

---

# 24. Docker requirements

File bắt buộc:

```txt
Dockerfile
docker-compose.yml
.dockerignore
.env.example
```

Docker Compose services:

```txt
api
postgres
redis
```

Yêu cầu:

```txt
api build từ Dockerfile.
postgres dùng postgres:15-alpine hoặc mới hơn.
Có volume lưu database.
Có network riêng.
API chạy port 3000.
PostgreSQL chạy port 5432.
Redis chạy port 6379 nếu dùng.
Biến môi trường lấy từ .env.
docker compose up -d --build chạy được.
```

---

# 25. Environment variables

```env
NODE_ENV=development
PORT=3000

POSTGRES_USER=corehr_user
POSTGRES_PASSWORD=corehr_password
POSTGRES_DB=corehr_db
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
DATABASE_URL="postgresql://corehr_user:corehr_password@postgres:5432/corehr_db?schema=public"

REDIS_HOST=redis
REDIS_PORT=6379

JWT_ACCESS_SECRET=change_me_access_secret
JWT_REFRESH_SECRET=change_me_refresh_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

BCRYPT_SALT_ROUNDS=10

DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_EMAIL=admin@corehr.local
DEFAULT_ADMIN_PASSWORD=Admin@123456

CORS_ORIGIN=http://localhost:5173
```

Frontend `.env.example`:

```env
VITE_API_BASE_URL=http://localhost:3000
VITE_APP_NAME=CoreHR
```

---

# 26. Thứ tự triển khai Backend Agent

```txt
1. Setup NestJS project.
2. Setup Dockerfile, docker-compose.yml, .env.example, .dockerignore.
3. Setup Prisma + PostgreSQL.
4. Tạo Prisma schema cho 14 bảng.
5. Tạo migration.
6. Tạo seed roles ADMIN, MANAGER, EMPLOYEE.
7. Tạo seed permissions, leave_types, admin user.
8. Tạo common response interceptor và exception filter.
9. Cấu hình Helmet, CORS, ValidationPipe, sanitize input, rate limit.
10. Tạo Auth module: login, refresh token rotation, logout, me.
11. Tạo JwtAuthGuard.
12. Tạo PermissionsGuard.
13. Tạo AccessControlService cho ABAC.
14. Tạo Users module.
15. Tạo Roles module.
16. Tạo Permissions module.
17. Tạo Policies module.
18. Tạo Departments module.
19. Tạo Positions module.
20. Tạo Employees module.
21. Tạo Employee Managers module.
22. Tạo Attendance module.
23. Tạo Leave Types module.
24. Tạo Leave Requests module.
25. Tạo Audit Logs module.
26. Thêm Swagger.
27. Viết README hướng dẫn chạy Docker.
28. Test API bằng Swagger/Postman.
```

---

# 27. Thứ tự triển khai Frontend Agent

```txt
1. Setup React + Vite + TypeScript.
2. Cài Mantine UI, React Router, TanStack Query, Axios.
3. Tạo Mantine theme bo góc mềm mại.
4. Tạo axios instance và auth store.
5. Tạo login page.
6. Tạo refresh token flow.
7. Tạo route guard: RequireAuth, RequireAdmin, RequireRole.
8. Tạo AppLayout cho /app.
9. Tạo AdminLayout cho /admin.
10. Tạo nút "Quản trị hệ thống" chỉ hiện với ADMIN.
11. Tạo /app dashboard cho manager.
12. Tạo My Team.
13. Tạo Team Attendance.
14. Tạo Team Leave Requests.
15. Tạo My Profile.
16. Tạo /admin dashboard.
17. Tạo Employee Management.
18. Tạo Department Management.
19. Tạo Position Management.
20. Tạo Manager Relationship Management.
21. Tạo Attendance Management.
22. Tạo Leave Request Management.
23. Tạo Leave Type Management.
24. Tạo User Management.
25. Tạo Role & Permission Management.
26. Tạo Policy Management.
27. Tạo Audit Log.
28. Thêm loading, empty, error state.
29. Thêm confirm modal cho thao tác nguy hiểm.
30. Test phân quyền route/menu/button.
```

---

# 28. Prompt giao cho Backend Coding Agent

```txt
Hãy code backend cho hệ thống CoreHR phase 1 bằng NestJS + Prisma + PostgreSQL + Docker Compose.

Yêu cầu chính:
- Hệ thống chỉ có 3 role: ADMIN, MANAGER, EMPLOYEE. Không tạo HR_MANAGER.
- ADMIN toàn quyền, bao gồm quản lý nhân sự, user, role, permission, policy, department, position, manager relationship, attendance, leave, audit log.
- MANAGER chỉ xem team/cấp dưới, xem attendance team, xem và duyệt/từ chối leave request của cấp dưới.
- EMPLOYEE chủ yếu dùng mobile app: check-in/check-out, tạo leave request, xem dữ liệu cá nhân.
- Có authentication bằng JWT access token + refresh token.
- Refresh token phải hash trong database.
- Có refresh token rotation và reuse detection.
- Có RBAC với roles, permissions, user_roles, role_permissions.
- Có ABAC bằng AccessControlService để giới hạn MANAGER theo employee_managers.
- Có các module: auth, users, roles, permissions, policies, departments, positions, employees, employee-managers, attendance, leave-types, leave-requests, audit-logs.
- Bỏ role HR_MANAGER, chỉ seed ADMIN, MANAGER, EMPLOYEE.
- Khi ADMIN tạo employee mới, backend phải tự động tạo user account tương ứng với username/email = company_email và password mặc định = birth_date theo format ddMMyyyy. User mới gán role EMPLOYEE và must_change_password = true.
- Dùng soft delete cho users, employees, departments, positions.
- Dùng class-validator cho DTO.
- Dùng Swagger.
- Bật security baseline: Helmet, CORS theo env, ValidationPipe whitelist/forbidNonWhitelisted/transform, sanitize input, rate limit auth endpoints.
- Không dùng raw SQL unsafe với input người dùng.
- Có Dockerfile, docker-compose.yml, .dockerignore, .env.example.
- docker compose up -d --build phải chạy được API, PostgreSQL và Redis nếu dùng.

Database gồm 14 bảng:
users, roles, permissions, user_roles, role_permissions, policies, departments, positions, employees, employee_managers, attendance_records, leave_types, leave_requests, audit_logs.

Không thêm AI, payroll, KPI, task recommendation, workload balancing trong phase 1.
```

---

# 29. Prompt giao cho Frontend Coding Agent

```txt
Hãy code frontend web cho hệ thống CoreHR phase 1 bằng React + TypeScript + Vite + Mantine UI.

Yêu cầu kiến trúc:
- Có route /login, /app/*, /admin/*.
- /admin/* chỉ role ADMIN được truy cập.
- /app/* dành cho MANAGER, ADMIN cũng có thể truy cập.
- EMPLOYEE không ưu tiên dùng web, nếu đăng nhập web có thể redirect tới trang thông báo dùng mobile app.
- Trong /app, nếu user là ADMIN thì hiển thị nút "Quản trị hệ thống" để vào /admin.
- MANAGER không thấy nút này.

Yêu cầu UI:
- Dùng Mantine UI.
- Giao diện mềm mại, hiện đại.
- Card, modal, input, button, table wrapper, filter box đều bo góc.
- Có loading state, empty state, error state.
- Có confirm modal cho thao tác nguy hiểm.
- Menu/button hiển thị theo role/permission.

/app cho MANAGER gồm:
- Dashboard
- My Team
- Team Attendance
- Team Leave Requests
- My Profile

/admin cho ADMIN gồm:
- Dashboard
- Employees
- Departments
- Positions
- Managers
- Attendance
- Leave Requests
- Leave Types
- Users
- Roles & Permissions
- Policies
- Audit Logs
- System Settings

Frontend cần:
- Axios instance.
- Interceptor gắn access token.
- Refresh token flow.
- Protected route.
- RequireAdmin route guard.
- TanStack Query cho fetch/cache.
- Auth store bằng Zustand hoặc Redux Toolkit.
- Không hardcode API URL, lấy từ .env.
```

---

# 30. Definition of Done

## 30.1 Backend Done

```txt
1. docker compose up -d --build chạy thành công.
2. API connect được PostgreSQL.
3. Prisma migration chạy thành công.
4. Seed tạo admin user, roles ADMIN/MANAGER/EMPLOYEE, permissions, leave types.
5. Login admin thành công.
6. Refresh token rotation hoạt động.
7. Logout thu hồi refresh token.
8. RBAC chặn đúng user không có permission.
9. ABAC chặn đúng manager ngoài phạm vi cấp dưới.
10. CRUD department hoạt động.
11. CRUD position hoạt động.
12. CRUD employee hoạt động.
13. Gán manager cho employee hoạt động.
14. Employee check-in/check-out API hoạt động.
15. Employee tạo leave request API hoạt động.
16. Manager approve/reject leave của cấp dưới hoạt động.
17. Manager không approve được leave không thuộc cấp dưới.
18. Employee không tự approve được leave của mình.
19. Audit log ghi lại thao tác quan trọng.
20. Security baseline hoạt động.
21. Swagger hiển thị đầy đủ API.
```

## 30.2 Frontend Done

```txt
1. Login/logout hoạt động.
2. Refresh token hoạt động.
3. /admin chỉ ADMIN truy cập được.
4. /app MANAGER và ADMIN truy cập được.
5. ADMIN thấy nút "Quản trị hệ thống".
6. MANAGER không thấy nút "Quản trị hệ thống".
7. /app Dashboard hoạt động.
8. My Team hoạt động.
9. Team Attendance hoạt động.
10. Team Leave Requests approve/reject hoạt động.
11. My Profile hoạt động.
12. /admin Dashboard hoạt động.
13. CRUD employees hoạt động.
14. CRUD departments hoạt động.
15. CRUD positions hoạt động.
16. Quản lý manager relationship hoạt động.
17. Quản lý users/roles/permissions hoạt động.
18. Quản lý leave types, leave requests, attendance hoạt động.
19. Audit log hiển thị được.
20. UI dùng Mantine, bo góc mềm mại.
21. Có loading, empty, error state.
22. Có confirm modal cho thao tác nguy hiểm.
```
