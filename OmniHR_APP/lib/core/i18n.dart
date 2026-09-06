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
  'Nhân viên': 'Employee',
  'Nhân viên OmniHR': 'OmniHR employee',
  'Công việc chưa đặt tên': 'Untitled task',
  'Hỏi HRGenie': 'Ask HRGenie',
  'Chấm công, nghỉ phép, công việc': 'Attendance, leave, tasks',
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
  'Tài khoản chưa có quyền chấm công.': 'This account cannot record attendance.',
  'Bạn chưa chấm công vào nên không thể chấm công ra.':
      'You have not checked in, so you cannot check out.',
  'Ngoài khu vực công ty': 'Outside company area',
  'Bạn đang cách văn phòng {distance}m, vượt quá bán kính cho phép {radius}m. Vẫn tiếp tục?':
      'You are {distance}m from the office, beyond the allowed radius of '
          '{radius}m. Continue anyway?',
  'Vẫn tiếp tục': 'Continue anyway',
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
  'Chưa có công việc': 'No tasks',
  'Công việc được giao cho bạn sẽ xuất hiện tại đây.':
      'Tasks assigned to you will appear here.',
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
  'Máy chủ API': 'API server',
  'Đổi mật khẩu': 'Change password',
  'Đăng xuất': 'Log out',
  'Bạn muốn đăng xuất khỏi OmniHR?': 'Log out of OmniHR?',
  'Hủy': 'Cancel',
  'Kỹ năng': 'Skills',
  'Kỹ năng bạn tự khai báo': 'Skills you\'ve added yourself',
  'Chưa có kỹ năng': 'No skills yet',
  'Thêm kỹ năng để quản lý gợi ý task chính xác hơn.':
      'Add skills so task suggestions can be more accurate.',
  'Thêm kỹ năng': 'Add skill',
  'Vui lòng chọn kỹ năng.': 'Please choose a skill.',
  'Bạn đã thêm tất cả kỹ năng khả dụng.': 'You\'ve added every available skill.',
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
  'Ngôn ngữ': 'Language',
  'Tiếng Việt': 'Vietnamese',
  'English': 'English',

  // Login
  'Không gian làm việc nhân sự hằng ngày.':
      'Your everyday HR workspace.',
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
  'API base URL không hợp lệ': 'Invalid API base URL',
  'Vui lòng nhập API base URL': 'Please enter the API base URL',
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
  'Kết nối máy chủ quá lâu. Vui lòng kiểm tra backend và API URL.':
      'The server took too long to respond. Check the backend and API URL.',
  'Không thể kết nối máy chủ. Vui lòng kiểm tra backend và thử lại.':
      'Could not reach the server. Check the backend and try again.',
  'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.':
      'Your session has expired. Please log in again.',
  'Bạn không có quyền thực hiện thao tác này.':
      'You don\'t have permission to do this.',
  'Bạn đã chấm công vào và chưa chấm công ra.':
      'You checked in and have not checked out yet.',
  'Bạn đã chấm công vào trong ca này.': 'You already checked in for this shift.',
  'Thời điểm hiện tại nằm ngoài khung giờ chấm công.':
      'This is outside the configured attendance hours.',
  'Cần có vị trí GPS để chấm công.': 'GPS location is required to check in.',
  'Chưa cấu hình vị trí chấm công của công ty.':
      'Company attendance location is not configured.',
  'Bạn đang ở ngoài phạm vi chấm công.':
      'You are outside the attendance radius.',
  'Không tìm thấy loại nghỉ phép.': 'Leave type not found.',
  'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.':
      'Start date must be before or equal to end date.',
  'Khoảng nghỉ không có ngày làm việc hợp lệ.':
      'The leave range has no valid working days.',
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
  'API URL không hợp lệ: {url}': 'Invalid API URL: {url}',
  'Không thể kết nối backend tại {url}. Vui lòng kiểm tra máy chủ.':
      'Could not connect to the backend at {url}. Check the server.',
  'Không lấy được vị trí hiện tại. Vui lòng bật GPS và thử lại.':
      'Could not get your location. Turn on GPS and try again.',
  'Ứng dụng chưa được cấp quyền vị trí. Vui lòng cấp quyền và thử lại.':
      'Location permission was not granted. Grant it and try again.',
  'Quyền vị trí đang bị chặn. Vui lòng mở cài đặt thiết bị để cấp quyền.':
      'Location permission is blocked. Open device settings to allow it.',
  'Không lấy được vị trí hiện tại. Vui lòng bật GPS, cấp quyền vị trí và thử lại.':
      'Could not get your location. Turn on GPS, grant permission and try '
          'again.',
};
