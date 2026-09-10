import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models/omni_models.dart';
import 'api_service.dart';
import 'i18n.dart';
import 'utils.dart';

class AppSession extends ChangeNotifier implements ApiClientSession {
  AppSession({bool bootstrapping = true}) : _bootstrapping = bootstrapping {
    api = ApiService(this);
  }

  static const _baseUrlKey = 'apiBaseUrl';
  static const _accessTokenKey = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';
  static const _userKey = 'authUser';
  static const _themeModeKey = 'themeMode';
  static const _languageKey = 'language';
  static const _secureStorage = FlutterSecureStorage();

  late final ApiService api;

  SharedPreferences? _prefs;
  bool _bootstrapping;
  String _baseUrl = defaultApiBaseUrl();
  String? _accessToken;
  String? refreshToken;
  AuthUser? user;
  Employee? employee;
  ThemeMode _themeMode = ThemeMode.light;
  AppLanguage _language = AppLanguage.vi;

  @override
  String get baseUrl => _baseUrl;

  @override
  String? get accessToken => _accessToken;

  bool get bootstrapping => _bootstrapping;
  bool get isLoggedIn => _accessToken != null && user != null;
  ThemeMode get themeMode => _themeMode;
  AppLanguage get language => _language;

  Future<void> bootstrap() async {
    _prefs = await SharedPreferences.getInstance();
    _baseUrl = cleanBaseUrl(
      _prefs?.getString(_baseUrlKey) ?? defaultApiBaseUrl(),
    );
    _accessToken = await _secureStorage.read(key: _accessTokenKey);
    refreshToken = await _secureStorage.read(key: _refreshTokenKey);

    final rawUser = await _secureStorage.read(key: _userKey);
    if (rawUser != null) {
      user = AuthUser.fromJson(mapOf(jsonDecode(rawUser)));
    }

    _themeMode = (_prefs?.getString(_themeModeKey)) == 'dark'
        ? ThemeMode.dark
        : ThemeMode.light;
    applyAppBrightness(
      _themeMode == ThemeMode.dark ? Brightness.dark : Brightness.light,
    );
    _language = (_prefs?.getString(_languageKey)) == 'en'
        ? AppLanguage.en
        : AppLanguage.vi;
    currentLanguage = _language;

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

  Future<void> setThemeMode(ThemeMode mode) async {
    if (_themeMode == mode) return;
    _themeMode = mode;
    applyAppBrightness(
      mode == ThemeMode.dark ? Brightness.dark : Brightness.light,
    );
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.setString(
      _themeModeKey,
      mode == ThemeMode.dark ? 'dark' : 'light',
    );
    notifyListeners();
  }

  Future<void> setLanguage(AppLanguage language) async {
    if (_language == language) return;
    _language = language;
    currentLanguage = language;
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.setString(
      _languageKey,
      language == AppLanguage.en ? 'en' : 'vi',
    );
    notifyListeners();
  }

  Future<void> login({
    required String usernameOrEmail,
    required String password,
    required String apiBaseUrl,
  }) async {
    final candidateBaseUrl = cleanBaseUrl(apiBaseUrl);
    late final http.Response response;
    try {
      response = await http
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
    } on FormatException {
      throw ApiException(
        tx('API URL không hợp lệ: {url}', {'url': candidateBaseUrl}),
      );
    } on Exception catch (error) {
      throw ApiException(
        tx('Không thể kết nối backend tại {url}. Vui lòng kiểm tra máy chủ.', {
          'url': candidateBaseUrl,
        }),
        errorCode: error.toString(),
      );
    }

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

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await api.post(
      '/auth/change-password',
      body: {'currentPassword': currentPassword, 'newPassword': newPassword},
    );
    await loadCurrentUser();
  }

  Future<void> logoutLocal({bool notify = true}) async {
    _accessToken = null;
    refreshToken = null;
    user = null;
    employee = null;
    await _secureStorage.delete(key: _accessTokenKey);
    await _secureStorage.delete(key: _refreshTokenKey);
    await _secureStorage.delete(key: _userKey);
    if (notify) notifyListeners();
  }

  Future<void> _saveSession() async {
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.setString(_baseUrlKey, _baseUrl);
    if (_accessToken != null) {
      await _secureStorage.write(key: _accessTokenKey, value: _accessToken!);
    }
    if (refreshToken != null) {
      await _secureStorage.write(key: _refreshTokenKey, value: refreshToken!);
    }
    if (user != null) {
      await _secureStorage.write(
        key: _userKey,
        value: jsonEncode(user!.toJson()),
      );
    }
  }
}
