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
        'Bạn đã chấm công vào và chưa chấm công ra.',
    'you already checked in for this shift.':
        'Bạn đã chấm công vào trong ca này.',
    'you have not checked in today, so you cannot check out. please contact admin for attendance adjustment.':
        'Bạn chưa chấm công vào nên không thể chấm công ra.',
    'attendance is outside configured shift hours.':
        'Thời điểm hiện tại nằm ngoài khung giờ chấm công.',
    'attendance location is required.': 'Cần có vị trí GPS để chấm công.',
    'company attendance location is not configured.':
        'Chưa cấu hình vị trí chấm công của công ty.',
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
  };

  final friendly = exactMessages[normalized];
  return friendly != null ? tx(friendly) : message;
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
        tx('Kết nối máy chủ quá lâu. Vui lòng kiểm tra backend và API URL.'),
      );
    } catch (error) {
      throw ApiException(
        tx('Không thể kết nối máy chủ. Vui lòng kiểm tra backend và thử lại.'),
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
