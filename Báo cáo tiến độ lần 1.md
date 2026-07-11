# Báo cáo tiến độ lần 1 - Dự án OmniHR

Ngày lập: 11/07/2026

## 1. Tổng quan

OmniHR là hệ thống quản lý nhân sự được xây dựng theo mô hình full-stack, gồm các thành phần chính:

- `OmniHR_BE`: Backend NestJS, Prisma, PostgreSQL, Docker.
- `OmniHR_WEB`: Web admin/manager bằng React, Vite, TypeScript, Mantine UI.
- `OmniHR_APP`: Mobile app Flutter cho nhân viên.
- `OmniHR_AI`: AI service FastAPI phục vụ HRGenie chatbot.
- `OmniHR_CHATBOT`: Tài liệu thiết kế, hướng dẫn triển khai và báo cáo phần chatbot/AI.

Đến thời điểm báo cáo, hệ thống đã vượt qua phạm vi CoreHR cơ bản. Ngoài các chức năng nhân sự như người dùng, nhân viên, phòng ban, chức danh, chấm công và nghỉ phép, dự án đã bổ sung thêm quản lý team, project, task, kỹ năng nhân viên, AI gợi ý chia task và chatbot HRGenie.

## 2. Nền tảng kỹ thuật đã hoàn thành

### 2.1 Backend

Backend đã được xây dựng trên NestJS với cấu trúc module rõ ràng:

- Cấu hình `ConfigModule` và validate biến môi trường bằng Joi.
- Tích hợp Prisma ORM với PostgreSQL.
- Có Dockerfile và `docker-compose.yml` để chạy backend, PostgreSQL, Redis và AI service.
- Có Swagger tại `/docs`.
- Có global `ValidationPipe`, exception filter và response interceptor.
- Có rate limit bằng `@nestjs/throttler`.
- Có cơ chế JWT authentication, role guard và permission guard.
- Có seed dữ liệu ban đầu cho role, permission, admin user, leave type, nhân viên mẫu và dữ liệu nghiệp vụ.

### 2.2 Web

Web đã được xây dựng bằng React + Vite + TypeScript:

- Dùng Mantine UI cho giao diện.
- Dùng React Router cho route `/login`, `/app`, `/admin`.
- Dùng TanStack Query, Axios và Zustand cho API/state.
- Có layout riêng cho Manager app và Admin app.
- Có route guard theo đăng nhập và role.
- Có API client tập trung trong `src/api/endpoints.ts`.
- Có i18n cơ bản và hệ thống menu theo vai trò.

### 2.3 Mobile

Mobile app đã được xây dựng bằng Flutter:

- Có màn đăng nhập, session, lưu token và refresh token.
- Có API service dùng chung.
- Có bottom navigation cho các nhóm chức năng chính.
- Có dashboard nhân viên, chấm công, nghỉ phép, task/profile và HRGenie.
- Có hỗ trợ lấy vị trí GPS phục vụ chấm công.
- Có assets hình ảnh login và chuẩn thiết kế riêng trong `DESIGN_STANDARD.md`.

### 2.4 AI service

AI service đã được xây dựng bằng FastAPI:

- Có endpoint health check.
- Có endpoint lập kế hoạch chatbot nội bộ cho NestJS.
- Có kiểm tra internal token.
- Có rule-based planner để test MVP không cần API key ngoài.
- Có cấu hình để chuyển sang LLM planner/hybrid planner.
- Có OpenAI-compatible client, prompt planner, schema validation và fallback về rule-based.
- Có test Python cho health, schema, planner, LLM fallback và intent regression.

## 3. Các chức năng backend đã làm được

### 3.1 Xác thực và bảo mật

- Đăng nhập bằng username/email và mật khẩu.
- Sinh access token và refresh token.
- Refresh token rotation.
- Logout và thu hồi refresh token.
- API `/auth/me` lấy thông tin người dùng hiện tại.
- Đổi mật khẩu.
- Hash mật khẩu bằng bcrypt.
- Bắt nhân viên đổi mật khẩu lần đầu bằng `mustChangePassword`.
- Bảo vệ API bằng JWT guard, role guard và permission guard.

### 3.2 RBAC và ABAC

- Có 3 role chính: `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Có bảng permission và role-permission.
- Seed permission theo từng role.
- Có guard kiểm tra permission trước khi vào controller.
- Có `AccessControlService` để xử lý phạm vi truy cập theo vai trò.
- Manager chỉ được thao tác trong phạm vi team/cấp dưới.
- Employee chỉ được xem hoặc cập nhật dữ liệu cá nhân được phép.

### 3.3 Quản lý người dùng

- CRUD user.
- Gán và gỡ role cho user.
- Reset mật khẩu user.
- Quản lý trạng thái active/inactive.
- Liên kết user với hồ sơ nhân viên.
- Kiểm tra ràng buộc khi user có role yêu cầu employee profile.

### 3.4 Quản lý nhân viên

- CRUD nhân viên.
- Xem danh sách toàn hệ thống hoặc theo team.
- API `/employees/me` cho hồ sơ cá nhân.
- Nhân viên có thể cập nhật một phần hồ sơ cá nhân.
- Khi tạo nhân viên, backend tự tạo user từ email công ty.
- Mật khẩu mặc định được tạo từ ngày sinh theo định dạng `ddMMyyyy`.
- Tự gán role `EMPLOYEE` hoặc thêm `MANAGER` tùy chức danh.
- Reset mật khẩu nhân viên.
- Lock/unlock tài khoản của nhân viên.
- Ghi audit log cho các thao tác quan trọng.

### 3.5 Phòng ban, chức danh, manager và team

- CRUD phòng ban.
- Có API lấy cây phòng ban.
- CRUD chức danh.
- Chức danh có liên kết phòng ban và hỗ trợ nhận diện chức danh quản lý.
- Quản lý quan hệ manager - subordinate.
- Kết thúc quan hệ quản lý bằng endpoint riêng.
- CRUD team.
- Thêm, cập nhật, xóa thành viên team.
- Có lịch sử/thông tin vai trò thành viên team.

### 3.6 Chấm công

- Nhân viên check-in và check-out.
- Lưu tọa độ, độ chính xác vị trí và thông tin ghi nhận.
- Có API xem chấm công cá nhân.
- Có API xem chấm công team.
- Admin có thể tạo hoặc điều chỉnh bản ghi chấm công.
- Có cấu hình hệ thống cho ca sáng, ca chiều và bán kính chấm công.
- Có migration riêng cho cấu hình vị trí chấm công.

### 3.7 Nghỉ phép

- CRUD loại nghỉ phép.
- Tạo đơn nghỉ phép.
- Xem đơn cá nhân, đơn team và danh sách toàn hệ thống.
- Manager/Admin duyệt hoặc từ chối đơn nghỉ.
- Nhân viên hủy đơn nghỉ phù hợp điều kiện.
- Backend tính `totalDays`.
- Có kiểm tra trạng thái đơn và quyền xử lý.

### 3.8 Audit log, dashboard và system settings

- Ghi audit log cho nhiều thao tác nghiệp vụ: tạo nhân viên, cập nhật, xóa, reset mật khẩu, tạo/chọn/cancel AI suggestion, chatbot action.
- Có API xem audit logs.
- Có dashboard cho admin.
- Có dashboard cho manager.
- Có API đọc/cập nhật system settings.

## 4. Project, task và kỹ năng đã làm được

### 4.1 Project

- CRUD project.
- Project có trạng thái, ngày bắt đầu/kết thúc, phòng ban/team liên quan.
- Có validate khi project đã hoàn tất hoặc bị hủy.
- Có phân quyền theo admin/manager.

### 4.2 Task

- CRUD task.
- Task có priority, status, start date, due date, estimate hour.
- Có task cha/con để chia nhỏ công việc.
- Có API task toàn hệ thống, task team và task của tôi.
- Có API assign task.
- Có API cập nhật trạng thái task.
- Có ràng buộc khi task cha/project đã đóng.
- Có lưu lịch sử phân công task trong `task_assignments`.
- Có API workload để xem tải công việc của nhân viên.

### 4.3 Skill và employee skill

- CRUD skill.
- Gán skill cho nhân viên.
- Cập nhật level, năm kinh nghiệm và thông tin kỹ năng.
- Có thiết kế kỹ năng cho AI chia task.
- Task có required skills và mức độ quan trọng của skill.
- AI suggestion dùng skill, workload và availability để tính điểm.

## 5. AI gợi ý chia task đã làm được

Module AI gợi ý chia task đã được triển khai ở backend theo hướng rule-based minh bạch, phù hợp đồ án:

- API tạo gợi ý: `POST /tasks/:taskId/ai-suggestions`.
- API xem gợi ý theo task.
- API xem lịch sử gợi ý.
- API xem chi tiết một suggestion.
- API chọn một suggestion để assign task.
- API cancel suggestion.
- Chỉ Admin/Manager có quyền tạo hoặc chọn gợi ý theo phạm vi được phép.
- Không gợi ý nhân viên inactive/deleted.
- Có lọc candidate theo team của task.
- Có tùy chọn `includeSelf`.
- Có tùy chọn `includeAvailability`.
- Có tùy chọn tính cả đơn nghỉ pending bằng `includePendingLeave`.
- Tính `skillScore`, `workloadScore`, `availabilityScore` và `finalScore`.
- Có reason giải thích tại sao nhân viên được gợi ý.
- Có `algorithmVersion` hiện tại là `rule-based-v3`.
- Có `taskFingerprint` để chặn chọn suggestion cũ khi task hoặc required skills đã đổi.
- Có TTL 24 giờ cho suggestion.
- Không cho chọn suggestion khi task đã DONE/CANCELLED hoặc suggestion đã expired/cancelled/selected.
- Có audit log cho generate, select, cancel và các tình huống quan trọng.
- Có unit test cho service AI suggestion.

## 6. HRGenie chatbot đã làm được

### 6.1 Backend NestJS

Backend đã có `ChatbotModule` làm lớp trung gian giữa mobile và AI service:

- Mobile chỉ gọi NestJS, không gọi trực tiếp Python AI service.
- API `POST /chatbot/message` gửi tin nhắn.
- API `GET /chatbot/conversations` xem hội thoại.
- API `GET /chatbot/conversations/:id/messages` xem lịch sử tin nhắn.
- API `POST /chatbot/actions/:actionId/confirm` xác nhận pending action.
- API `POST /chatbot/actions/:actionId/cancel` hủy pending action.
- Lưu conversation, message và pending action vào database.
- Có giới hạn độ dài message.
- Có giới hạn history gửi sang AI service.
- Có rate limit theo user.
- Có validate tool call từ AI trước khi execute.
- Có danh sách tool cho HRGenie theo quyền user.
- Có pending action cho hành động ghi dữ liệu, không cho AI tự ghi trực tiếp.
- Có confirm/cancel action để tạo hoặc hủy đơn nghỉ.
- Có audit log cho tạo pending action, confirm, execute, cancel và lỗi tool.

### 6.2 Tool chatbot hiện có

Các tool đã có trong chatbot backend gồm:

- Lấy hồ sơ cá nhân.
- Xem số dư ngày nghỉ.
- Xem loại nghỉ phép.
- Xem các đơn nghỉ gần đây.
- Tạo nháp đơn nghỉ chờ xác nhận.
- Hủy đơn nghỉ pending của chính mình.
- Xem chấm công hôm nay.
- Xem chính sách/giờ chấm công.
- Xem task cá nhân hoặc task sắp đến hạn nếu user có quyền tương ứng.

### 6.3 AI service cho chatbot

AI service đã hỗ trợ:

- Rule-based planner cho MVP.
- Hybrid mode dùng LLM rồi fallback về rule-based.
- Validate JSON schema đầu ra.
- Chặn tool ngoài danh sách `availableTools`.
- Chặn yêu cầu vượt phạm vi, yêu cầu bỏ qua quyền, hoặc yêu cầu thao tác nhạy cảm.
- Cấu hình OpenAI-compatible provider.
- Prompt riêng cho HRGenie planner.
- Test fallback khi LLM lỗi, JSON sai hoặc confidence thấp.

### 6.4 Mobile HRGenie

Mobile app đã có màn HRGenie:

- Gửi tin nhắn tới `/chatbot/message`.
- Hiển thị hội thoại dạng chat.
- Hiển thị pending action card.
- Cho người dùng xác nhận hoặc hủy action.
- Gọi API confirm/cancel action tương ứng.

## 7. Web đã làm được

### 7.1 Auth và layout

- Màn login.
- Hydrate auth khi mở app.
- Guard route theo đăng nhập.
- Guard route theo role `ADMIN` và `MANAGER`.
- Layout `/app` cho manager.
- Layout `/admin` cho admin.
- Trang forbidden và trang thông báo cho employee web.

### 7.2 Web cho Manager

Route manager hiện có:

- Dashboard.
- My Team.
- Teams.
- Employee Skills theo team.
- Team Attendance.
- Team Leave Requests.
- Projects theo team.
- Team Tasks.
- AI Task Suggestions theo team.
- My Profile.

### 7.3 Web cho Admin

Route admin hiện có:

- Dashboard.
- Users.
- Departments.
- Positions.
- Leave Types.
- Skills.
- Roles & Permissions.
- Audit Logs.
- Policies.
- System Settings.

### 7.4 API client web

Web đã có client cho các nhóm API:

- Auth.
- Dashboard và system settings.
- Employees.
- Departments.
- Teams.
- Projects.
- Skills.
- Employee skills.
- Tasks.
- Task assignments.
- Task workload.
- AI task suggestions.
- Positions.
- Employee managers.
- Attendance.
- Leave types.
- Leave requests.
- Users.
- Roles, permissions.
- Audit logs.

## 8. Mobile app đã làm được

Mobile hiện có các module:

- `auth`: đăng nhập.
- `shell`: khung điều hướng chính.
- `dashboard`: dashboard nhân viên.
- `attendance`: chấm công.
- `leave`: nghỉ phép.
- `tasks`: màn task/leave workflow hiện có.
- `profile`: hồ sơ cá nhân, đổi mật khẩu, logout.
- `chat`: HRGenie chatbot.

Các chức năng đáng chú ý:

- Tự chọn API URL phù hợp khi chạy web, Android emulator hoặc local.
- Lưu session bằng `shared_preferences`.
- Tự refresh token khi cần.
- Gọi API backend qua service dùng chung.
- Lấy GPS bằng `geolocator` khi check-in/check-out.
- Xem lịch sử chấm công cá nhân.
- Tạo và hủy đơn nghỉ.
- Xem hồ sơ cá nhân.
- Đổi mật khẩu.
- Chat với HRGenie và xác nhận pending action.

## 9. Database, migration và seed

Schema Prisma hiện có các nhóm bảng chính:

- User, Role, Permission, UserRole, RolePermission.
- Policy.
- Department, Position, Employee, EmployeeManager.
- Team, TeamMember.
- AttendanceRecord, SystemSetting.
- LeaveType, LeaveRequest.
- AuditLog.
- ChatbotConversation, ChatbotMessage, ChatbotPendingAction.
- Project.
- Skill, PositionSkill, EmployeeSkill.
- Task, TaskRequiredSkill, TaskAssignment.
- AiTaskSuggestion, AiTaskSuggestionItem.

Các migration đã có từ init đến chatbot:

- Khởi tạo CoreHR.
- Thêm AI assignment/task.
- Thêm cấu hình chấm công theo vị trí.
- Việt hóa leave type.
- Mapping position-skill.
- Career level cho employee.
- Team structure và team member history.
- Project/department/task hierarchy.
- Task technologies.
- Skill importance v3.
- Chatbot MVP.
- Chatbot action executed.

Seed đã có:

- Role `ADMIN`, `MANAGER`, `EMPLOYEE`.
- Permission matrix theo vai trò.
- Admin mặc định.
- Leave types.
- Phòng ban, chức danh, nhân viên mẫu.
- Dữ liệu team/project/task/skill phục vụ demo AI.
- File seed lớn cho AI: `seed-ai-large.ts`.

## 10. Kiểm thử đã có

Backend đã có unit test/spec cho:

- Auth service.
- Response interceptor.
- Sanitize input pipe.
- Common utils.
- Projects service.
- Tasks service.
- AI task suggestions service.
- Chatbot service.
- Chatbot tools service.

AI service đã có test cho:

- Health endpoint.
- Planner schema.
- Tool planner.
- LLM planner service.
- Intent regression và fallback.

Mobile đã có `test/widget_test.dart`.

Các lệnh kiểm tra đã được chuẩn bị trong README/package:

- Backend: `npm run prisma:validate`, `npm run prisma:generate`, `npm run build`, `npm run test`.
- Web: `npm run build`, `npm run lint`.
- Mobile: `dart format`, `flutter analyze`, `flutter test`.
- AI: `pytest`.

## 11. Tài liệu đã có

Dự án đã có nhiều tài liệu phục vụ triển khai và bảo vệ:

- README backend hướng dẫn chạy local, Docker và HRGenie chatbot.
- README AI service hướng dẫn chạy local, rule-based planner và LLM planner.
- README mobile hướng dẫn chạy Flutter, Android và build APK.
- Báo cáo tiến độ cũ ngày 19/06/2026.
- Tài liệu mô tả AI gợi ý chia task.
- Tài liệu tổng hợp hệ thống đã làm được.
- Tài liệu yêu cầu chỉnh sửa AI gợi ý chia task.
- Tài liệu thiết kế HRGenie chatbot và AI service.
- Báo cáo hoàn thiện OmniHR AI Service MVP.
- Hướng dẫn giai đoạn 2 nối LLM thật cho HRGenie.

## 12. Những điểm cần chú ý/chưa hoàn thiện

Một số điểm nên tiếp tục kiểm tra hoặc hoàn thiện ở các lần sau:

- Worktree hiện đang có nhiều file thay đổi/chưa commit, gồm cả source, generated `dist`, `node_modules/.prisma` và log file.
- Cần chạy lại đầy đủ test/build sau khi chốt code để xác nhận trạng thái cuối.
- Web admin hiện route `employees` đang redirect sang `users`, nên nếu cần màn employee admin riêng thì cần kiểm tra lại UX.
- Mobile `TasksScreen` hiện vẫn đang dùng một phần luồng leave type/leave request, cần rà soát nếu muốn task mobile đúng nghĩa.
- Cần kiểm thử end-to-end thật cho HRGenie: login mobile, hỏi chấm công, tạo nháp nghỉ, confirm, kiểm tra DB.
- Cần dọn generated/log file trước khi commit nếu không muốn đưa vào repository.
- Nếu bật LLM thật, cần cấu hình API key, base URL, timeout và chạy test fallback.

## 13. Kết luận

Trong lần tiến độ này, dự án OmniHR đã hoàn thành được nền tảng hệ thống nhân sự full-stack với backend, web, mobile, database, phân quyền, chấm công, nghỉ phép, project/task, kỹ năng, AI gợi ý chia task và chatbot HRGenie. Hệ thống đã có đủ khung nghiệp vụ để demo các vai trò Admin, Manager và Employee, đồng thời đã có kiến trúc AI an toàn: AI chỉ lập kế hoạch/gợi ý, còn NestJS vẫn là nơi kiểm tra quyền và thực thi nghiệp vụ.
