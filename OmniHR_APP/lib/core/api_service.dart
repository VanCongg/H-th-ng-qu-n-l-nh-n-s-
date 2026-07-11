import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

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

  throw ApiException(message, statusCode: response.statusCode, errorCode: code);
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
      throw ApiException('Server timeout. Check backend and API URL.');
    } catch (error) {
      throw ApiException('Cannot connect to server: $error');
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
