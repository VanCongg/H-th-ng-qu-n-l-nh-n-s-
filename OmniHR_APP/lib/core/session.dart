import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/omni_models.dart';
import 'api_service.dart';
import 'utils.dart';

class AppSession extends ChangeNotifier implements ApiClientSession {
  AppSession({bool bootstrapping = true}) : _bootstrapping = bootstrapping {
    api = ApiService(this);
  }

  static const _baseUrlKey = 'apiBaseUrl';
  static const _accessTokenKey = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';
  static const _userKey = 'authUser';

  late final ApiService api;

  SharedPreferences? _prefs;
  bool _bootstrapping;
  String _baseUrl = defaultApiBaseUrl();
  String? _accessToken;
  String? refreshToken;
  AuthUser? user;
  Employee? employee;

  @override
  String get baseUrl => _baseUrl;

  @override
  String? get accessToken => _accessToken;

  bool get bootstrapping => _bootstrapping;
  bool get isLoggedIn => _accessToken != null && user != null;

  Future<void> bootstrap() async {
    _prefs = await SharedPreferences.getInstance();
    _baseUrl = cleanBaseUrl(_prefs?.getString(_baseUrlKey) ?? defaultApiBaseUrl());
    _accessToken = _prefs?.getString(_accessTokenKey);
    refreshToken = _prefs?.getString(_refreshTokenKey);

    final rawUser = _prefs?.getString(_userKey);
    if (rawUser != null) {
      user = AuthUser.fromJson(mapOf(jsonDecode(rawUser)));
    }

    if (_accessToken != null) {
      try {
        await loadCurrentUser();
        await loadEmployeeProfile(silent: true);
      } catch (_) {
        await logoutLocal(notify: false);
      }
    }

    _bootstrapping = false;
    notifyListeners();
  }

  Future<void> login({
    required String usernameOrEmail,
    required String password,
    required String apiBaseUrl,
  }) async {
    final candidateBaseUrl = cleanBaseUrl(apiBaseUrl);
    final response = await http
        .post(
          Uri.parse('$candidateBaseUrl/auth/login'),
          headers: const {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'usernameOrEmail': usernameOrEmail,
            'password': password,
          }),
        )
        .timeout(const Duration(seconds: 20));

    final login = LoginResponse.fromJson(mapOf(unwrapResponse(response)));
    _baseUrl = candidateBaseUrl;
    _accessToken = login.accessToken;
    refreshToken = login.refreshToken;
    user = login.user;
    await _saveSession();

    try {
      await loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = null;
    }

    notifyListeners();
  }

  Future<void> loadCurrentUser() async {
    final data = await api.get('/auth/me');
    user = AuthUser.fromJson(mapOf(data));
    await _saveSession();
    notifyListeners();
  }

  Future<Employee?> loadEmployeeProfile({bool silent = false}) async {
    final currentUser = user;
    if (currentUser == null) return null;
    if (currentUser.employeeId == null &&
        !currentUser.roles.contains('EMPLOYEE')) {
      return null;
    }

    final data = await api.get('/employees/me');
    employee = Employee.fromJson(mapOf(data));
    if (!silent) notifyListeners();
    return employee;
  }

  @override
  Future<bool> refreshAccessToken() async {
    final token = refreshToken;
    if (token == null) return false;

    try {
      final response = await http
          .post(
            Uri.parse('${cleanBaseUrl(_baseUrl)}/auth/refresh'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'refreshToken': token}),
          )
          .timeout(const Duration(seconds: 20));

      final login = LoginResponse.fromJson(mapOf(unwrapResponse(response)));
      _accessToken = login.accessToken;
      refreshToken = login.refreshToken;
      user = login.user;
      await _saveSession();
      notifyListeners();
      return true;
    } catch (_) {
      await logoutLocal();
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // Local logout should still happen if the server is unreachable.
    }
    await logoutLocal();
  }

  Future<void> logoutLocal({bool notify = true}) async {
    _accessToken = null;
    refreshToken = null;
    user = null;
    employee = null;
    await _prefs?.remove(_accessTokenKey);
    await _prefs?.remove(_refreshTokenKey);
    await _prefs?.remove(_userKey);
    if (notify) notifyListeners();
  }

  Future<void> _saveSession() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.setString(_baseUrlKey, _baseUrl);
    if (_accessToken != null) {
      await _prefs?.setString(_accessTokenKey, _accessToken!);
    }
    if (refreshToken != null) {
      await _prefs?.setString(_refreshTokenKey, refreshToken!);
    }
    if (user != null) {
      await _prefs?.setString(_userKey, jsonEncode(user!.toJson()));
    }
  }
}
