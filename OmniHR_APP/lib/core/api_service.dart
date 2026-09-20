import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'i18n.dart';
import 'utils.dart';

abstract class ApiClientSession {
  String get baseUrl;
  String? get accessToken;
  Future<bool> refreshAccessToken();
}

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode, this.errorCode});

  final String message;
  final int? statusCode;
  final String? errorCode;

  @override
  String toString() => message;
}

String friendlyBackendMessage(String message, {String? code, int? statusCode}) {
  final normalized = message.trim().toLowerCase();

  if (code == 'FORBIDDEN' || statusCode == 403) {
    return tx('Bạn không có quyền thực hiện thao tác này.');
  }
  if (statusCode == 401) {
    return tx('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  }

  const exactMessages = {
    'you already checked in and have not checked out.':
        'Chấm công trùng: bạn đã chấm công vào và chưa chấm công ra.',
    'you already checked in for this shift.':
        'Chấm công trùng: bạn đã chấm công vào trong ca này.',
    'you already checked out.': 'Chấm công trùng: bạn đã chấm công ra rồi.',
    'you have not checked in today, so you cannot check out. please contact admin for attendance adjustment.':
        'Bạn chưa chấm công vào nên không thể chấm công ra.',
    'attendance location is required.': 'Cần có vị trí GPS để chấm công.',
    'attendance location is outside company radius.':
        'Bạn đang ở ngoài phạm vi chấm công.',
    'leave type not found': 'Không tìm thấy loại nghỉ phép.',
    'start date must be before or equal to end date':
        'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.',
    'leave range has no valid working days':
        'Khoảng nghỉ không có ngày làm việc hợp lệ.',
    'leave request not found': 'Không tìm thấy đơn nghỉ phép.',
    'only pending leave request can be cancelled':
        'Chỉ có thể hủy đơn nghỉ đang chờ duyệt.',
    'only pending leave request can be processed':
        'Chỉ có thể xử lý đơn nghỉ đang chờ duyệt.',
    'leave request overlaps with an existing pending or approved request':
        'Khoảng nghỉ bị trùng với đơn đang chờ duyệt hoặc đã duyệt.',
    'employee profile not found': 'Không tìm thấy hồ sơ nhân viên.',
    'employee not found': 'Không tìm thấy nhân viên.',
    'invalid credentials': 'Tên đăng nhập hoặc mật khẩu không đúng.',
    'account is inactive or deleted':
        'Tài khoản đã bị khóa hoặc không còn hoạt động.',
    'current password is invalid': 'Mật khẩu hiện tại không đúng.',
    'user not found': 'Không tìm thấy tài khoản.',
    'invalid refresh token':
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'refresh token reused or invalid':
        'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
    'unauthorized': 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    'task not found': 'Không tìm thấy công việc.',
    'team-level task status is calculated from its subtasks':
        'Trạng thái công việc cấp nhóm được tính từ các công việc con.',
    'a team-level task cannot be assigned to an employee':
        'Công việc cấp nhóm không thể giao cho một nhân viên.',
    'a team-level task requires a project and a team':
        'Công việc cấp nhóm cần có dự án và nhóm.',
    'ai assignment suggestions are only available for subtasks':
        'Gợi ý phân công bằng AI chỉ áp dụng cho công việc con.',
    'ai suggestion already selected': 'Gợi ý AI này đã được chọn.',
    'ai suggestion denied': 'Bạn không có quyền thao tác với gợi ý AI này.',
    'ai suggestion has been cancelled': 'Gợi ý AI đã bị hủy.',
    'ai suggestion has expired because the task changed':
        'Gợi ý AI đã hết hạn vì công việc đã thay đổi.',
    'ai suggestion has expired because the task is closed':
        'Gợi ý AI đã hết hạn vì công việc đã đóng.',
    'ai suggestion has expired': 'Gợi ý AI đã hết hạn.',
    'ai task suggestion item not found': 'Không tìm thấy mục gợi ý AI.',
    'ai task suggestion not found': 'Không tìm thấy gợi ý AI.',
    'action has expired': 'Thao tác đã hết hạn.',
    'action is not pending': 'Thao tác không còn ở trạng thái chờ xác nhận.',
    'assign a department manager after employees belong to this department':
        'Chỉ có thể chỉ định trưởng phòng khi phòng ban đã có nhân viên.',
    'attendance record not found': 'Không tìm thấy bản ghi chấm công.',
    'cannot generate ai suggestion for closed task':
        'Không thể tạo gợi ý AI cho công việc đã đóng.',
    'company email already exists': 'Email công ty đã tồn tại.',
    'conversation not found': 'Không tìm thấy cuộc hội thoại.',
    'date range is too wide': 'Khoảng thời gian quá dài.',
    'department cannot be its own parent':
        'Phòng ban không thể là phòng ban cha của chính nó.',
    'department hierarchy contains a cycle': 'Cây phòng ban bị lặp vòng.',
    'department is required when selecting a position':
        'Cần chọn phòng ban khi chọn chức danh.',
    'department manager must belong to this department':
        'Trưởng phòng phải thuộc phòng ban này.',
    'department not found': 'Không tìm thấy phòng ban.',
    'department parent cannot be one of its descendants':
        'Phòng ban cha không thể là phòng ban con của nó.',
    'department scope denied': 'Phòng ban nằm ngoài phạm vi quản lý của bạn.',
    'email delivery is not configured': 'Chưa cấu hình gửi email.',
    'employee already has an active direct manager':
        'Nhân viên đã có quản lý trực tiếp.',
    'employee cannot manage themselves':
        'Nhân viên không thể tự quản lý chính mình.',
    'employee code already exists': 'Mã nhân viên đã tồn tại.',
    'employee position is required before assigning skills':
        'Nhân viên cần có chức danh trước khi gán kỹ năng.',
    'employee profile is required': 'Cần có hồ sơ nhân viên.',
    'employee profile requires employee code, full name, birth date, department, and position':
        'Hồ sơ nhân viên cần có mã nhân viên, họ tên, ngày sinh, phòng ban và chức danh.',
    'employee skill not found': 'Không tìm thấy kỹ năng của nhân viên.',
    'employee skill update denied':
        'Bạn không có quyền cập nhật kỹ năng của nhân viên này.',
    'employee user not found': 'Không tìm thấy tài khoản của nhân viên.',
    'end date cannot be before start date':
        'Ngày kết thúc không được trước ngày bắt đầu.',
    'forbidden': 'Bạn không có quyền thực hiện thao tác này.',
    'hr_manager role is not supported in phase 1':
        'Vai trò HR_MANAGER chưa được hỗ trợ ở giai đoạn 1.',
    'last used date cannot be in the future':
        'Ngày sử dụng gần nhất không được ở tương lai.',
    'leave request id is required': 'Cần có mã đơn nghỉ phép.',
    'manager position requires manager role':
        'Chức danh quản lý cần vai trò Quản lý.',
    'manager relationship already exists': 'Quan hệ quản lý đã tồn tại.',
    'manager relationship is already inactive':
        'Quan hệ quản lý đã ngừng hiệu lực.',
    'manager relationship not found': 'Không tìm thấy quan hệ quản lý.',
    'manager relationship would create a cycle':
        'Quan hệ quản lý này sẽ tạo vòng lặp.',
    'manager scope denied': 'Nhân viên nằm ngoài phạm vi quản lý của bạn.',
    'month must be between 1 and 12': 'Tháng phải từ 1 đến 12.',
    'no candidates available for ai suggestion':
        'Không có ứng viên phù hợp để AI gợi ý.',
    'notification not found': 'Không tìm thấy thông báo.',
    'only a department head can create a project':
        'Chỉ trưởng phòng mới có thể tạo dự án.',
    'only the department head can assign a team-level task':
        'Chỉ trưởng phòng mới có thể giao công việc cấp nhóm.',
    'only the department head can manage this project':
        'Chỉ trưởng phòng mới có thể quản lý dự án này.',
    'only the department head or team lead can create a subtask':
        'Chỉ trưởng phòng hoặc trưởng nhóm mới có thể tạo công việc con.',
    'only two task levels are supported':
        'Chỉ hỗ trợ tối đa hai cấp công việc.',
    'parent task is closed or has an invalid scope':
        'Công việc cha đã đóng hoặc không hợp lệ.',
    'parent task not found': 'Không tìm thấy công việc cha.',
    'pending action not found': 'Không tìm thấy thao tác đang chờ xác nhận.',
    'permission denied': 'Bạn không có quyền thực hiện thao tác này.',
    'permission not found': 'Không tìm thấy quyền.',
    'position does not belong to selected department':
        'Chức danh không thuộc phòng ban đã chọn.',
    'position not found': 'Không tìm thấy chức danh.',
    'project has active tasks': 'Dự án vẫn còn công việc đang thực hiện.',
    'project is closed': 'Dự án đã đóng.',
    'project not found': 'Không tìm thấy dự án.',
    'project scope denied': 'Dự án nằm ngoài phạm vi quản lý của bạn.',
    'required skills are only defined on subtasks':
        'Kỹ năng yêu cầu chỉ được khai báo ở công việc con.',
    'role not found': 'Không tìm thấy vai trò.',
    'role permission not found': 'Không tìm thấy quyền của vai trò.',
    'selected ai suggestion cannot be cancelled':
        'Không thể hủy gợi ý AI đã được chọn.',
    'skill is not applicable to employee position':
        'Kỹ năng không phù hợp với chức danh của nhân viên.',
    'skill not found': 'Không tìm thấy kỹ năng.',
    'start date must be before or equal to due date':
        'Ngày bắt đầu phải trước hoặc bằng hạn hoàn thành.',
    'subtask due date cannot be after its parent task':
        'Hạn của công việc con không được sau công việc cha.',
    'subtask project must match its parent':
        'Công việc con phải thuộc cùng dự án với công việc cha.',
    'subtask start date cannot be before its parent task':
        'Ngày bắt đầu của công việc con không được trước công việc cha.',
    'subtask team must match its parent':
        'Công việc con phải thuộc cùng nhóm với công việc cha.',
    'system role cannot be deleted': 'Không thể xóa vai trò hệ thống.',
    'task assignee is outside manager scope':
        'Người được giao nằm ngoài phạm vi quản lý của bạn.',
    'task assignee must belong to selected team':
        'Người được giao phải thuộc nhóm đã chọn.',
    'task required skills must be unique':
        'Kỹ năng yêu cầu của công việc không được trùng lặp.',
    'task scope denied': 'Công việc nằm ngoài phạm vi của bạn.',
    'task status update denied':
        'Bạn không có quyền cập nhật trạng thái công việc này.',
    'task team must belong to the project department':
        'Nhóm thực hiện phải thuộc phòng ban của dự án.',
    'task update denied': 'Bạn không có quyền cập nhật công việc này.',
    'team has active tasks': 'Nhóm vẫn còn công việc đang thực hiện.',
    'team lead and members must belong to the selected department':
        'Trưởng nhóm và thành viên phải thuộc phòng ban đã chọn.',
    'team member not found': 'Không tìm thấy thành viên nhóm.',
    'team not found': 'Không tìm thấy nhóm.',
    'team-level actual hours are calculated from subtasks':
        'Số giờ thực tế của công việc cấp nhóm được tính từ các công việc con.',
    'team-level task has active subtasks':
        'Công việc cấp nhóm vẫn còn công việc con đang thực hiện.',
    'technologies are defined on the team-level task':
        'Công nghệ được khai báo ở công việc cấp nhóm.',
    'unsupported chatbot action': 'Thao tác chatbot không được hỗ trợ.',
    'user role not found': 'Không tìm thấy vai trò của tài khoản.',
    'you cannot approve or reject your own leave request':
        'Bạn không thể tự duyệt hoặc từ chối đơn nghỉ của mình.',
    'todate must be after or equal to fromdate':
        'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.',
  };

  final friendly = exactMessages[normalized];
  if (friendly != null) return tx(friendly);

  // Messages that embed a runtime value cannot be matched exactly.
  if (RegExp(r'^\w+ is (required|invalid)$').hasMatch(normalized)) {
    return tx('Thông tin gửi lên không hợp lệ. Vui lòng thử lại.');
  }
  return message;
}

dynamic unwrapResponse(http.Response response) {
  dynamic decoded;
  if (response.body.isNotEmpty) {
    try {
      decoded = jsonDecode(utf8.decode(response.bodyBytes));
    } catch (_) {
      decoded = response.body;
    }
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    if (decoded is Map && decoded.containsKey('data')) {
      return decoded['data'];
    }
    return decoded;
  }

  var message = 'Request failed (${response.statusCode})';
  String? code;
  if (decoded is Map) {
    final rawMessage = decoded['message'];
    if (rawMessage is List) {
      message = rawMessage.join(', ');
    } else if (rawMessage != null) {
      message = rawMessage.toString();
    }
    code = decoded['errorCode']?.toString();
  }

  throw ApiException(
    friendlyBackendMessage(
      message,
      code: code,
      statusCode: response.statusCode,
    ),
    statusCode: response.statusCode,
    errorCode: code,
  );
}

class ApiService {
  ApiService(this.session);

  final ApiClientSession session;

  Uri _uri(String path, Map<String, Object?> query) {
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final queryParameters = <String, String>{};
    for (final entry in query.entries) {
      final value = entry.value;
      if (value != null && value.toString().isNotEmpty) {
        queryParameters[entry.key] = value.toString();
      }
    }

    return Uri.parse('${cleanBaseUrl(session.baseUrl)}/$cleanPath').replace(
      queryParameters: queryParameters.isEmpty ? null : queryParameters,
    );
  }

  Future<dynamic> request(
    String method,
    String path, {
    Map<String, Object?> query = const {},
    Object? body,
    bool authenticated = true,
    bool retry = true,
  }) async {
    if (authenticated && session.accessToken == null) {
      throw ApiException(tx('Bạn cần đăng nhập để thực hiện thao tác này.'));
    }

    final headers = <String, String>{
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
      if (authenticated && session.accessToken != null)
        'Authorization': 'Bearer ${session.accessToken}',
    };

    final uri = _uri(path, query);
    final encodedBody = body == null ? null : jsonEncode(body);
    late http.Response response;

    try {
      switch (method.toUpperCase()) {
        case 'POST':
          response = await http
              .post(uri, headers: headers, body: encodedBody)
              .timeout(const Duration(seconds: 45));
          break;
        case 'PATCH':
          response = await http
              .patch(uri, headers: headers, body: encodedBody)
              .timeout(const Duration(seconds: 45));
          break;
        case 'DELETE':
          response = await http
              .delete(uri, headers: headers, body: encodedBody)
              .timeout(const Duration(seconds: 45));
          break;
        default:
          response = await http
              .get(uri, headers: headers)
              .timeout(const Duration(seconds: 45));
          break;
      }
    } on TimeoutException {
      throw ApiException(
        tx(
          'Kết nối máy chủ quá lâu. Vui lòng kiểm tra kết nối mạng và thử lại.',
        ),
      );
    } catch (error) {
      throw ApiException(
        tx(
          'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
        ),
        errorCode: error.toString(),
      );
    }

    if (response.statusCode == 401 &&
        authenticated &&
        retry &&
        !path.contains('/auth/login') &&
        !path.contains('/auth/refresh')) {
      final refreshed = await session.refreshAccessToken();
      if (refreshed) {
        return request(
          method,
          path,
          query: query,
          body: body,
          authenticated: authenticated,
          retry: false,
        );
      }
    }

    return unwrapResponse(response);
  }

  Future<dynamic> get(String path, {Map<String, Object?> query = const {}}) {
    return request('GET', path, query: query);
  }

  Future<dynamic> post(String path, {Object? body}) {
    return request('POST', path, body: body);
  }

  Future<dynamic> patch(String path, {Object? body}) {
    return request('PATCH', path, body: body);
  }

  Future<dynamic> delete(String path, {Object? body}) {
    return request('DELETE', path, body: body);
  }

  Future<List<T>> getList<T>(
    String path,
    T Function(Map<String, dynamic>) parser, {
    Map<String, Object?> query = const {},
  }) async {
    final data = await get(path, query: query);
    final rawItems = data is Map && data['items'] is List
        ? data['items'] as List
        : data is List
        ? data
        : const [];

    return rawItems.map((item) => parser(mapOf(item))).toList();
  }
}
