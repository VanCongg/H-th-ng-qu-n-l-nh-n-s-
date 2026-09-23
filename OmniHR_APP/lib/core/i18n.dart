enum AppLanguage { vi, en }

/// Current UI language. Vietnamese strings are the source text written
/// directly at each call site; [tx] looks up an English translation when
/// this is [AppLanguage.en] and falls back to the Vietnamese source
/// otherwise. Mutated by [AppSession.setLanguage].
AppLanguage currentLanguage = AppLanguage.vi;

/// Translates [vi] (the Vietnamese source string used at the call site) to
/// English when the active language is English, otherwise returns it as-is.
/// Pass [args] to substitute `{name}`-style placeholders in the template.
String tx(String vi, [Map<String, String>? args]) {
  final template = currentLanguage == AppLanguage.en
      ? (_enDictionary[vi] ?? vi)
      : vi;
  if (args == null || args.isEmpty) return template;
  var result = template;
  for (final entry in args.entries) {
    result = result.replaceAll('{${entry.key}}', entry.value);
  }
  return result;
}

const Map<String, String> _enDictionary = {
  // Shell / navigation
  'Trang chủ': 'Home',
  'Tổng quan công việc hôm nay': 'Today\'s overview',
  'Chấm công': 'Attendance',
  'Nghỉ phép': 'Leave',
  'Công việc': 'Tasks',
  'Cá nhân': 'Profile',
  'Kỹ năng': 'Skills',
  'Cài đặt': 'Settings',
  'Nhân viên': 'Employee',
  'Nhân viên OmniHR': 'OmniHR employee',
  'Công việc chưa đặt tên': 'Untitled task',
  'Hỏi HRGenie': 'Ask HRGenie',
  'Chấm công, nghỉ phép, công việc': 'Attendance, leave, tasks',
  'Chạm để hiện lại bong bóng': 'Tap to bring the bubble back',
  'Hiện trợ lý': 'Show the assistant',
  'Xin chào,': 'Hello,',

  // Dashboard
  'Nghỉ phép gần đây': 'Recent leave',
  'Chưa có đơn nghỉ phép.': 'No leave requests yet.',
  'Công việc sắp đến hạn': 'Upcoming tasks',
  'Không có công việc đang mở.': 'No open tasks.',

  // Status / priority (utils.dart friendly*)
  'Chưa làm': 'To do',
  'Đang làm': 'In progress',
  'Chờ review': 'In review',
  'Hoàn thành': 'Done',
  'Đã hủy': 'Cancelled',
  'Chờ duyệt': 'Pending',
  'Đã duyệt': 'Approved',
  'Từ chối': 'Rejected',
  'Đang làm việc': 'Active',
  'Đã nghỉ việc': 'Terminated',
  'Thấp': 'Low',
  'Trung bình': 'Medium',
  'Cao': 'High',
  'Khẩn cấp': 'Urgent',
  'Chấm công vào': 'Check in',
  'Chấm công ra': 'Check out',
  'chờ duyệt': 'pending',
  'đã duyệt': 'approved',
  'tổng': 'total',
  'đang mở': 'open',
  'quá hạn': 'overdue',
  'hoàn thành': 'done',
  'lượt hôm nay': 'today',

  // Attendance
  'Ca sáng': 'Morning shift',
  'Ca chiều': 'Afternoon shift',
  'Đúng giờ': 'On time',
  'Đi muộn': 'Late',
  'Về sớm': 'Early out',
  'Điều chỉnh': 'Manual adjustment',
  'Vào': 'In',
  'Ra': 'Out',
  'Chưa có': 'None yet',
  'Chấm công hôm nay': "Today's attendance",
  '{type} lúc {time}': '{type} at {time}',
  'Hôm nay chưa có lượt chấm công.': 'No attendance recorded today.',
  'Bắt đầu ca': 'Start shift',
  'Kết thúc ca': 'End shift',
  'Đang lấy GPS': 'Getting GPS location',
  'Tháng trước': 'Previous month',
  'Tháng sau': 'Next month',
  'Tháng {month}/{year}': '{month}/{year}',
  'T2': 'Mon',
  'T3': 'Tue',
  'T4': 'Wed',
  'T5': 'Thu',
  'T6': 'Fri',
  'T7': 'Sat',
  'CN': 'Sun',
  'Chưa có lượt chấm công trong ngày này': 'No attendance on this day',
  '{count} lượt chấm công': '{count} check-ins',
  'Ngày này chưa ghi nhận chấm công.': 'No attendance recorded for this day.',
  'Tài khoản chưa có quyền chấm công.':
      'This account cannot record attendance.',
  'Bạn chưa chấm công vào nên không thể chấm công ra.':
      'You have not checked in, so you cannot check out.',
  'Ứng dụng sẽ lấy vị trí hiện tại để gửi lên hệ thống.':
      'The app will use your current location for this record.',
  'Xác nhận': 'Confirm',
  'Đã chấm công vào.': 'Checked in.',
  'Đã chấm công ra.': 'Checked out.',

  // Leave
  'Số ngày phép còn lại': 'Remaining leave balance',
  'Tính theo các đơn đã được duyệt': 'Based on approved requests',
  'Xem thêm ({count})': 'View more ({count})',
  'Thu gọn': 'Collapse',
  'Đơn nghỉ của tôi': 'My leave requests',
  'Chưa có đơn nghỉ': 'No leave requests',
  'Đơn nghỉ đã gửi sẽ xuất hiện tại đây.':
      'Submitted requests will appear here.',
  'Tạo đơn nghỉ': 'New leave request',
  'Tạo đơn nghỉ phép': 'Create leave request',
  'Không giới hạn': 'Unlimited',
  'Chưa có loại nghỉ khả dụng.': 'No leave type available.',
  'Loại nghỉ': 'Leave type',
  'Lý do': 'Reason',
  'Vui lòng chọn loại nghỉ.': 'Please choose a leave type.',
  'Ngày kết thúc không được trước ngày bắt đầu.':
      'End date cannot be before the start date.',
  'Vui lòng nhập lý do nghỉ.': 'Please enter a reason.',
  'Đang gửi...': 'Submitting...',
  'Gửi đơn': 'Submit request',
  'Đã tạo đơn nghỉ phép.': 'Leave request created.',
  'Hủy đơn nghỉ phép': 'Cancel leave request',
  'Bạn muốn hủy đơn {type} từ {start} đến {end}?':
      'Cancel the {type} request from {start} to {end}?',
  'Không hủy': 'Keep it',
  'Xác nhận hủy': 'Confirm cancel',
  'Đã hủy đơn nghỉ phép.': 'Leave request cancelled.',
  'Hủy đơn': 'Cancel',
  'Lý do từ chối: {reason}': 'Rejection reason: {reason}',
  'ngày': 'days',

  // Tasks
  'Quá hạn': 'Overdue',
  'Tất cả': 'All',
  'Đang mở': 'Open',
  'Xong': 'Done',
  'Danh sách công việc': 'Task list',
  'Không có công việc trong tháng này': 'No tasks due this month',
  'Không có hạn ({count})': 'No due date ({count})',
  'Không thuộc tháng nào nên luôn hiển thị ở đây':
      'These belong to no month, so they always show here',
  'Dùng mũi tên phía trên để xem tháng khác.':
      'Use the arrows above to look at another month.',
  'Đây là công việc cấp nhóm. Trạng thái của nó được tính từ các công việc con, không đổi trực tiếp được.':
      'This is a team-level task. Its status is derived from its subtasks and '
      'cannot be set directly.',
  'Không có công việc phù hợp': 'No matching tasks',
  'Đổi bộ lọc để xem các công việc khác.':
      'Change the filter to see other tasks.',
  'Tài khoản chưa có quyền cập nhật trạng thái công việc.':
      'This account cannot update task status.',
  'Đã cập nhật trạng thái công việc.': 'Task status updated.',
  'Ngày bắt đầu': 'Start date',
  'Hạn hoàn thành': 'Due date',
  'Dự án': 'Project',
  'Nhóm': 'Team',
  'Giờ dự kiến': 'Estimated hours',
  'Kỹ năng cần có': 'Required skills',
  'Công việc cha': 'Parent task',
  'Công việc con ({count})': 'Subtasks ({count})',
  'Đổi trạng thái': 'Change status',
  'Hạn {date}': 'Due {date}',
  'Quá hạn {date}': 'Overdue {date}',

  // Profile
  'Email công ty': 'Company email',
  'Trạng thái': 'Status',
  'Ngày vào làm': 'Hire date',
  'Số điện thoại': 'Phone number',
  'Tài khoản': 'Account',
  'Tên đăng nhập': 'Username',
  'Đổi mật khẩu': 'Change password',
  'Đăng xuất': 'Log out',
  'Bạn muốn đăng xuất khỏi OmniHR?': 'Log out of OmniHR?',
  'Hủy': 'Cancel',
  'Kỹ năng bạn tự khai báo': 'Skills you\'ve added yourself',
  'Chưa có kỹ năng': 'No skills yet',
  'Thêm kỹ năng để quản lý gợi ý task chính xác hơn.':
      'Add skills so task suggestions can be more accurate.',
  'Thêm kỹ năng': 'Add skill',
  'Vui lòng chọn kỹ năng.': 'Please choose a skill.',
  'Bạn đã thêm tất cả kỹ năng khả dụng.':
      'You\'ve added every available skill.',
  'Mức độ': 'Proficiency',
  'Mới bắt đầu': 'Beginner',
  'Khá': 'Advanced',
  'Chuyên gia': 'Expert',
  'Số năm kinh nghiệm (tùy chọn)': 'Years of experience (optional)',
  'Ghi chú (tùy chọn)': 'Notes (optional)',
  'Đang lưu...': 'Saving...',
  'Lưu kỹ năng': 'Save skill',
  'Đã thêm kỹ năng.': 'Skill added.',
  'Mật khẩu hiện tại': 'Current password',
  'Mật khẩu mới': 'New password',
  'Nhập lại mật khẩu mới': 'Confirm new password',
  'Hiện mật khẩu': 'Show password',
  'Ẩn mật khẩu': 'Hide password',
  'Vui lòng nhập mật khẩu hiện tại': 'Please enter your current password',
  'Vui lòng nhập mật khẩu mới': 'Please enter a new password',
  'Mật khẩu mới phải có ít nhất 6 ký tự':
      'New password must be at least 6 characters',
  'Vui lòng nhập lại mật khẩu mới': 'Please confirm the new password',
  'Mật khẩu nhập lại không khớp': 'Passwords do not match',
  'Lưu': 'Save',
  'Đã đổi mật khẩu.': 'Password changed.',
  'năm': 'yrs',
  'Gần nhất {date}': 'Last used {date}',
  'Thử lại': 'Retry',
  'Đang tải dữ liệu': 'Loading data',
  'Cài đặt hiển thị': 'Display settings',
  'Giao diện tối': 'Dark theme',
  'Giao diện sáng': 'Light theme',
  'Ngôn ngữ': 'Language',
  'Tiếng Việt': 'Vietnamese',
  'English': 'English',

  // Login
  'Không gian làm việc nhân sự hằng ngày.': 'Your everyday HR workspace.',
  'Chấm công, nghỉ phép, công việc và hồ sơ cá nhân trên một ứng dụng.':
      'Attendance, leave, tasks and your profile in one app.',
  'Ứng dụng nhân viên': 'Employee app',
  'Đăng nhập': 'Log in',
  'Sử dụng tài khoản OmniHR để tiếp tục.':
      'Use your OmniHR account to continue.',
  'Tên đăng nhập hoặc email': 'Username or email',
  'Vui lòng nhập tên đăng nhập hoặc email': 'Please enter a username or email',
  'Mật khẩu': 'Password',
  'Vui lòng nhập mật khẩu': 'Please enter a password',
  'Đang đăng nhập...': 'Logging in...',

  // Chat
  'Nhập câu hỏi cho HRGenie': 'Ask HRGenie a question',
  'Làm mới': 'Refresh',
  'Tôi đã mở hội thoại mới. Bạn muốn hỏi gì?':
      'Started a new conversation. What would you like to ask?',
  'Xin chào, tôi là HRGenie. Bạn muốn hỏi về chấm công, nghỉ phép hay công việc?':
      'Hi, I\'m HRGenie. Ask me about attendance, leave, or tasks.',
  'Hôm nay tôi đã chấm công chưa?': 'Have I checked in today?',
  'Tôi còn bao nhiêu ngày phép?': 'How many leave days do I have left?',
  'Tôi muốn xin nghỉ': 'I\'d like to request leave',
  'Công việc nào của tôi sắp đến hạn?': 'Which of my tasks are due soon?',
  'Tháng này có ai sinh nhật?': 'Any birthdays this month?',
  'Manager của tôi là ai?': 'Who is my manager?',
  'Tháng này tôi đi muộn mấy lần?': 'How many times was I late this month?',
  'Tôi đang tham gia dự án nào?': 'Which projects am I on?',
  'Team tôi gồm những ai?': 'Who is on my team?',
  'Tháng này tôi hoàn thành bao nhiêu task?':
      'How many tasks did I finish this month?',
  'Tôi chưa có phản hồi phù hợp.': 'I don\'t have a good answer for that yet.',
  'Đã xác nhận thao tác.': 'Action confirmed.',
  'Đã hủy thao tác.': 'Action cancelled.',
  'Xác nhận hủy đơn nghỉ phép': 'Confirm cancelling leave request',
  'Nháp đơn nghỉ phép': 'Draft leave request',
  'Đơn hủy': 'Cancelling',
  'Xác nhận thao tác': 'Confirm action',
  'Từ ngày': 'From',
  'Đến ngày': 'To',
  'Số ngày': 'Days',
  'Chờ xác nhận': 'Awaiting confirmation',
  'Hết hạn': 'Expires',

  // Generic / errors
  'Bạn cần đăng nhập để thực hiện thao tác này.':
      'You need to log in to do this.',
  'Kết nối máy chủ quá lâu. Vui lòng kiểm tra kết nối mạng và thử lại.':
      'The server took too long to respond. Check your connection and try '
      'again.',
  'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.':
      'Could not reach the server. Check your connection and try again.',
  'Cấu hình máy chủ không hợp lệ. Vui lòng liên hệ quản trị viên.':
      'The server configuration is invalid. Please contact your administrator.',
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':
      'Your session has expired. Please log in again.',
  'Bạn không có quyền thực hiện thao tác này.':
      'You don\'t have permission to do this.',
  'Chấm công trùng: bạn đã chấm công vào và chưa chấm công ra.':
      'Duplicate punch: you checked in and have not checked out yet.',
  'Chấm công trùng: bạn đã chấm công vào trong ca này.':
      'Duplicate punch: you already checked in for this shift.',
  'Chấm công trùng: bạn đã chấm công ra rồi.':
      'Duplicate punch: you already checked out.',
  'Chấm công trùng: bạn đã chấm công vào lúc {time} và chưa chấm công ra.':
      'Duplicate punch: you checked in at {time} and have not checked out.',
  'Chấm công trùng: bạn đã chấm công ra lúc {time}.':
      'Duplicate punch: you already checked out at {time}.',
  'Cần có vị trí GPS để chấm công.': 'GPS location is required to check in.',
  'Bạn đang ở ngoài phạm vi chấm công.':
      'You are outside the attendance radius.',
  'Không tìm thấy loại nghỉ phép.': 'Leave type not found.',
  'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.':
      'Start date must be before or equal to end date.',
  'Khoảng nghỉ không có ngày làm việc hợp lệ.':
      'The leave range has no valid working days.',
  'Khoảng ngày đã chọn không có ngày làm việc nào. Vui lòng chọn ngày trong tuần.':
      'The selected range has no working days. Please pick weekdays.',
  'Không tìm thấy đơn nghỉ phép.': 'Leave request not found.',
  'Chỉ có thể hủy đơn nghỉ đang chờ duyệt.':
      'Only a pending request can be cancelled.',
  'Chỉ có thể xử lý đơn nghỉ đang chờ duyệt.':
      'Only a pending request can be processed.',
  'Khoảng nghỉ bị trùng với đơn đang chờ duyệt hoặc đã duyệt.':
      'This range overlaps a pending or approved request.',
  'Không tìm thấy hồ sơ nhân viên.': 'Employee profile not found.',
  'Không tìm thấy nhân viên.': 'Employee not found.',
  'Tên đăng nhập hoặc mật khẩu không đúng.': 'Incorrect username or password.',
  'Tài khoản đã bị khóa hoặc không còn hoạt động.':
      'This account is locked or inactive.',
  'Mật khẩu hiện tại không đúng.': 'Current password is incorrect.',
  'Không tìm thấy tài khoản.': 'Account not found.',
  'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.':
      'Your session is no longer valid. Please log in again.',
  'Không tìm thấy công việc.': 'Task not found.',
  'Trạng thái công việc cấp nhóm được tính từ các công việc con.':
      'A team task\'s status is derived from its subtasks.',
  'Không lấy được vị trí hiện tại. Vui lòng bật GPS và thử lại.':
      'Could not get your location. Turn on GPS and try again.',
  'Ứng dụng chưa được cấp quyền vị trí. Vui lòng cấp quyền và thử lại.':
      'Location permission was not granted. Grant it and try again.',
  'Quyền vị trí đang bị chặn. Vui lòng mở cài đặt thiết bị để cấp quyền.':
      'Location permission is blocked. Open device settings to allow it.',
  'Không lấy được vị trí hiện tại. Vui lòng bật GPS, cấp quyền vị trí và thử lại.':
      'Could not get your location. Turn on GPS, grant permission and try '
      'again.',
  'Công việc cấp nhóm không thể giao cho một nhân viên.':
      'A team-level task cannot be assigned to an employee.',
  'Công việc cấp nhóm cần có dự án và nhóm.':
      'A team-level task requires a project and a team.',
  'Gợi ý phân công bằng AI chỉ áp dụng cho công việc con.':
      'AI assignment suggestions are only available for subtasks.',
  'Gợi ý AI này đã được chọn.': 'AI suggestion already selected.',
  'Bạn không có quyền thao tác với gợi ý AI này.': 'AI suggestion denied.',
  'Gợi ý AI đã bị hủy.': 'AI suggestion has been cancelled.',
  'Gợi ý AI đã hết hạn vì công việc đã thay đổi.':
      'AI suggestion has expired because the task changed.',
  'Gợi ý AI đã hết hạn vì công việc đã đóng.':
      'AI suggestion has expired because the task is closed.',
  'Gợi ý AI đã hết hạn.': 'AI suggestion has expired.',
  'Không tìm thấy mục gợi ý AI.': 'AI task suggestion item not found.',
  'Không tìm thấy gợi ý AI.': 'AI task suggestion not found.',
  'Thao tác đã hết hạn.': 'Action has expired.',
  'Thao tác không còn ở trạng thái chờ xác nhận.': 'Action is not pending.',
  'Chỉ có thể chỉ định trưởng phòng khi phòng ban đã có nhân viên.':
      'Assign a department manager after employees belong to this department.',
  'Không tìm thấy bản ghi chấm công.': 'Attendance record not found.',
  'Không thể tạo gợi ý AI cho công việc đã đóng.':
      'Cannot generate AI suggestion for closed task.',
  'Email công ty đã tồn tại.': 'Company email already exists.',
  'Không tìm thấy cuộc hội thoại.': 'Conversation not found.',
  'Khoảng thời gian quá dài.': 'Date range is too wide.',
  'Phòng ban không thể là phòng ban cha của chính nó.':
      'Department cannot be its own parent.',
  'Cây phòng ban bị lặp vòng.': 'Department hierarchy contains a cycle.',
  'Cần chọn phòng ban khi chọn chức danh.':
      'Department is required when selecting a position.',
  'Trưởng phòng phải thuộc phòng ban này.':
      'Department manager must belong to this department.',
  'Không tìm thấy phòng ban.': 'Department not found.',
  'Phòng ban cha không thể là phòng ban con của nó.':
      'Department parent cannot be one of its descendants.',
  'Phòng ban nằm ngoài phạm vi quản lý của bạn.': 'Department scope denied.',
  'Chưa cấu hình gửi email.': 'Email delivery is not configured.',
  'Nhân viên đã có quản lý trực tiếp.':
      'Employee already has an active direct manager.',
  'Nhân viên không thể tự quản lý chính mình.':
      'Employee cannot manage themselves.',
  'Mã nhân viên đã tồn tại.': 'Employee code already exists.',
  'Nhân viên cần có chức danh trước khi gán kỹ năng.':
      'Employee position is required before assigning skills.',
  'Cần có hồ sơ nhân viên.': 'Employee profile is required.',
  'Hồ sơ nhân viên cần có mã nhân viên, họ tên, ngày sinh, phòng ban và chức danh.':
      'Employee profile requires employee code, full name, birth date, department, and position.',
  'Không tìm thấy kỹ năng của nhân viên.': 'Employee skill not found.',
  'Bạn không có quyền cập nhật kỹ năng của nhân viên này.':
      'Employee skill update denied.',
  'Không tìm thấy tài khoản của nhân viên.': 'Employee user not found.',
  'Vai trò HR_MANAGER chưa được hỗ trợ ở giai đoạn 1.':
      'HR_MANAGER role is not supported in phase 1.',
  'Ngày sử dụng gần nhất không được ở tương lai.':
      'Last used date cannot be in the future.',
  'Cần có mã đơn nghỉ phép.': 'Leave request id is required.',
  'Chức danh quản lý cần vai trò Quản lý.':
      'Manager position requires MANAGER role.',
  'Quan hệ quản lý đã tồn tại.': 'Manager relationship already exists.',
  'Quan hệ quản lý đã ngừng hiệu lực.':
      'Manager relationship is already inactive.',
  'Không tìm thấy quan hệ quản lý.': 'Manager relationship not found.',
  'Quan hệ quản lý này sẽ tạo vòng lặp.':
      'Manager relationship would create a cycle.',
  'Nhân viên nằm ngoài phạm vi quản lý của bạn.': 'Manager scope denied.',
  'Tháng phải từ 1 đến 12.': 'Month must be between 1 and 12.',
  'Không có ứng viên phù hợp để AI gợi ý.':
      'No candidates available for AI suggestion.',
  'Không tìm thấy thông báo.': 'Notification not found.',
  'Chỉ trưởng phòng mới có thể tạo dự án.':
      'Only a department head can create a project.',
  'Chỉ trưởng phòng mới có thể giao công việc cấp nhóm.':
      'Only the department head can assign a team-level task.',
  'Chỉ trưởng phòng mới có thể quản lý dự án này.':
      'Only the department head can manage this project.',
  'Chỉ trưởng phòng hoặc trưởng nhóm mới có thể tạo công việc con.':
      'Only the department head or team lead can create a subtask.',
  'Chỉ hỗ trợ tối đa hai cấp công việc.': 'Only two task levels are supported.',
  'Công việc cha đã đóng hoặc không hợp lệ.':
      'Parent task is closed or has an invalid scope.',
  'Không tìm thấy công việc cha.': 'Parent task not found.',
  'Không tìm thấy thao tác đang chờ xác nhận.': 'Pending action not found.',
  'Không tìm thấy quyền.': 'Permission not found.',
  'Chức danh không thuộc phòng ban đã chọn.':
      'Position does not belong to selected department.',
  'Không tìm thấy chức danh.': 'Position not found.',
  'Dự án vẫn còn công việc đang thực hiện.': 'Project has active tasks.',
  'Dự án đã đóng.': 'Project is closed.',
  'Không tìm thấy dự án.': 'Project not found.',
  'Dự án nằm ngoài phạm vi quản lý của bạn.': 'Project scope denied.',
  'Kỹ năng yêu cầu chỉ được khai báo ở công việc con.':
      'Required skills are only defined on subtasks.',
  'Không tìm thấy vai trò.': 'Role not found.',
  'Không tìm thấy quyền của vai trò.': 'Role permission not found.',
  'Không thể hủy gợi ý AI đã được chọn.':
      'Selected AI suggestion cannot be cancelled.',
  'Kỹ năng không phù hợp với chức danh của nhân viên.':
      'Skill is not applicable to employee position.',
  'Không tìm thấy kỹ năng.': 'Skill not found.',
  'Ngày bắt đầu phải trước hoặc bằng hạn hoàn thành.':
      'Start date must be before or equal to due date.',
  'Hạn của công việc con không được sau công việc cha.':
      'Subtask due date cannot be after its parent task.',
  'Công việc con phải thuộc cùng dự án với công việc cha.':
      'Subtask project must match its parent.',
  'Ngày bắt đầu của công việc con không được trước công việc cha.':
      'Subtask start date cannot be before its parent task.',
  'Công việc con phải thuộc cùng nhóm với công việc cha.':
      'Subtask team must match its parent.',
  'Không thể xóa vai trò hệ thống.': 'System role cannot be deleted.',
  'Người được giao nằm ngoài phạm vi quản lý của bạn.':
      'Task assignee is outside manager scope.',
  'Người được giao phải thuộc nhóm đã chọn.':
      'Task assignee must belong to selected team.',
  'Kỹ năng yêu cầu của công việc không được trùng lặp.':
      'Task required skills must be unique.',
  'Công việc nằm ngoài phạm vi của bạn.': 'Task scope denied.',
  'Bạn không có quyền cập nhật trạng thái công việc này.':
      'Task status update denied.',
  'Nhóm thực hiện phải thuộc phòng ban của dự án.':
      'Task team must belong to the project department.',
  'Bạn không có quyền cập nhật công việc này.': 'Task update denied.',
  'Nhóm vẫn còn công việc đang thực hiện.': 'Team has active tasks.',
  'Trưởng nhóm và thành viên phải thuộc phòng ban đã chọn.':
      'Team lead and members must belong to the selected department.',
  'Không tìm thấy thành viên nhóm.': 'Team member not found.',
  'Không tìm thấy nhóm.': 'Team not found.',
  'Số giờ thực tế của công việc cấp nhóm được tính từ các công việc con.':
      'Team-level actual hours are calculated from subtasks.',
  'Công việc cấp nhóm vẫn còn công việc con đang thực hiện.':
      'Team-level task has active subtasks.',
  'Công nghệ được khai báo ở công việc cấp nhóm.':
      'Technologies are defined on the team-level task.',
  'Thao tác chatbot không được hỗ trợ.': 'Unsupported chatbot action.',
  'Không tìm thấy vai trò của tài khoản.': 'User role not found.',
  'Bạn không thể tự duyệt hoặc từ chối đơn nghỉ của mình.':
      'You cannot approve or reject your own leave request.',
  'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.':
      'ToDate must be after or equal to fromDate.',
  'Thông tin gửi lên không hợp lệ. Vui lòng thử lại.':
      'The submitted information is invalid. Please try again.',
  'Con người là trọng tâm. Rõ ràng mỗi ngày.':
      'People first. Clarity every day.',
  'Chấm công không hợp lệ': 'Check-in not allowed',
  'Bạn đang cách văn phòng {distance}m, vượt quá bán kính cho phép {radius}m. Hãy tới khu vực công ty rồi chấm công lại.':
      'You are {distance}m from the office, beyond the {radius}m limit. Go to '
      'the workplace and try again.',
  'Bạn đang ở ngoài khu vực công ty nên không thể chấm công. Hãy tới nơi làm việc rồi thử lại.':
      'You are outside the company area, so this check-in is not allowed. Go '
      'to the workplace and try again.',
  'Đã hiểu': 'Got it',
  'Đơn nghỉ phép đã được duyệt': 'Leave request approved',
  'Đơn nghỉ phép bị từ chối': 'Leave request rejected',
  'Bạn được giao công việc mới': 'New task assigned',
  'Công việc bị trả về để sửa': 'Task returned for rework',
  'Bản ghi chấm công được điều chỉnh': 'Attendance record adjusted',
  'Bạn được giao công việc "{task}".': 'You were assigned to "{task}".',
  'Công việc "{task}" cần chỉnh sửa trước khi được duyệt.':
      '"{task}" needs changes before it can be accepted.',
  'Đơn nghỉ phép từ {start} đến {end} của bạn đã được duyệt.':
      'Your leave request from {start} to {end} was approved.',
  'Quản trị viên đã thêm bản ghi chấm công ngày {date}.':
      'An admin added an attendance record for {date}.',
  'Quản trị viên đã sửa bản ghi chấm công ngày {date}.':
      'An admin updated the attendance record for {date}.',
  'Đọc tất cả': 'Mark all read',
  'Chưa có thông báo': 'No notifications yet',
  'Chốt': 'Final',
  'Mức độ hoàn thành': 'Completion level',
  'Nhận xét của bạn': 'Your comment',
  'Nhận xét của quản lý': 'Manager\'s comment',
  'Quản lý': 'Manager',
  'Bạn đã đọc hết thông báo.': 'You are all caught up.',
  'Đã đánh dấu tất cả là đã đọc.': 'All notifications marked as read.',
  '{count} thông báo chưa đọc': '{count} unread notifications',
  'Thông báo mới sẽ xuất hiện tại đây.': 'New notifications will appear here.',
  'Thông báo': 'Notifications',
  'chưa đọc': 'unread',
  'Đã chốt': 'Finalized',
  'Đã gửi, chờ quản lý': 'Submitted, awaiting manager',
  'Phép năm cộng dồn theo tháng làm việc đủ; loại khác tính theo đơn đã duyệt':
      'Annual leave accrues per full month worked; other types count approved requests',
  'Vào ca': 'Check in',
  'Ra ca': 'Check out',
  'Đã ghi nhận': 'Recorded',
  'Khoảng cách': 'Distance',

  // Onboarding
  'Chạm để tiếp tục': 'Tap to continue',
  'Bỏ qua': 'Skip',
  'Tiếp theo': 'Next',
  'Bắt đầu': 'Get started',
  'Chấm công bằng GPS': 'Check in with GPS',
  'Mở tab Chấm công và bấm Vào ca / Ra ca khi đang ở văn phòng. Ứng dụng tự kiểm tra bạn có trong phạm vi cho phép.':
      'Open the Attendance tab and tap Check in / Check out while at the '
      'office. The app verifies you are within the allowed range.',
  'Xin nghỉ phép nhanh': 'Request leave in seconds',
  'Tạo đơn trong tab Nghỉ phép, theo dõi số ngày phép còn lại và trạng thái duyệt của quản lý.':
      'Create requests in the Leave tab and track your remaining days and '
      'your manager\'s approval.',
  'Theo dõi công việc': 'Stay on top of tasks',
  'Tab Công việc hiển thị việc được giao, hạn hoàn thành và cho phép bạn cập nhật tiến độ.':
      'The Tasks tab shows your assignments and due dates, and lets you '
      'update progress.',
  'Trợ lý HRGenie trả lời câu hỏi về chấm công, nghỉ phép, công việc và có thể soạn đơn giúp bạn. Mọi thao tác đều cần bạn xác nhận.':
      'HRGenie answers questions about attendance, leave and tasks, and can '
      'draft requests for you. Every action needs your confirmation.',
  'Cấp quyền cho ứng dụng': 'Allow app permissions',
  'OmniHR cần quyền sau để tính năng hoạt động chính xác. Bạn có thể thay đổi bất cứ lúc nào trong cài đặt thiết bị.':
      'OmniHR needs the permission below for its features to work correctly. '
      'You can change it anytime in your device settings.',
  'Vị trí (GPS)': 'Location (GPS)',
  'Xác nhận bạn đang ở văn phòng khi chấm công. Vị trí chỉ được lấy lúc bạn bấm Vào ca / Ra ca.':
      'Confirms you are at the office when checking in. Location is only read '
      'when you tap Check in / Check out.',
  'Cho phép và tiếp tục': 'Allow and continue',
  'Để sau': 'Not now',
};
