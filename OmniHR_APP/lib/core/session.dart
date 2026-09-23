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
  AppSession({bool bootstrapping = true, bool onboardingCompleted = false})
    : _bootstrapping = bootstrapping,
      _onboardingCompleted = onboardingCompleted {
    api = ApiService(this);
  }

  /// Older builds let users type the API URL at login and saved it here.
  /// Its presence also means the app was used before onboarding existed.
  static const _legacyBaseUrlKey = 'apiBaseUrl';
  static const _onboardingKey = 'onboardingCompleted';
  static const _accessTokenKey = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';
  static const _userKey = 'authUser';
  static const _themeModeKey = 'themeMode';
  static const _genieHiddenKey = 'hrGenieHidden';
  static const _languageKey = 'language';
  static const _secureStorage = FlutterSecureStorage();

  late final ApiService api;

  SharedPreferences? _prefs;
  bool _bootstrapping;
  bool _onboardingCompleted;
  final String _baseUrl = cleanBaseUrl(defaultApiBaseUrl());
  String? _accessToken;
  String? refreshToken;
  AuthUser? user;
  Employee? employee;
  Future<bool>? _refreshInFlight;
  ThemeMode _themeMode = ThemeMode.light;
  bool _genieHidden = false;
  AppLanguage _language = AppLanguage.vi;

  @override
  String get baseUrl => _baseUrl;

  @override
  String? get accessToken => _accessToken;

  bool get bootstrapping => _bootstrapping;
  bool get onboardingCompleted => _onboardingCompleted;
  bool get isLoggedIn => _accessToken != null && user != null;
  ThemeMode get themeMode => _themeMode;

  /// The HRGenie bubble tucked against the edge of the home screen. Kept in
  /// the session, not in the bubble's own state, so the home screen's
  /// "Hỏi HRGenie" card can bring it back and so it survives a restart.
  bool get genieHidden => _genieHidden;
  AppLanguage get language => _language;

  Future<void> bootstrap() async {
    _prefs = await SharedPreferences.getInstance();
    if (_prefs?.containsKey(_legacyBaseUrlKey) ?? false) {
      await _prefs?.remove(_legacyBaseUrlKey);
      await _prefs?.setBool(_onboardingKey, true);
    }
    _onboardingCompleted = _prefs?.getBool(_onboardingKey) ?? false;

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
    _genieHidden = _prefs?.getBool(_genieHiddenKey) ?? false;
    _language = (_prefs?.getString(_languageKey)) == 'en'
        ? AppLanguage.en
        : AppLanguage.vi;
    currentLanguage = _language;

    if (_accessToken != null) {
      try {
        await loadCurrentUser();
        await loadEmployeeProfile(silent: true);
      } on ApiException catch (error) {
        // Same rule as refreshAccessToken: only a rejected token ends the
        // session. Starting the app while the server is down or the phone is
        // offline must not throw the user out - the stored profile is enough
        // to open the app, and the next call refreshes or signs out.
        final status = error.statusCode;
        if (status == 401 || status == 403) await logoutLocal(notify: false);
      } catch (_) {
        // Unexpected local failure (bad cached payload): start clean.
        await logoutLocal(notify: false);
      }
    }

    _bootstrapping = false;
    notifyListeners();
  }

  Future<void> completeOnboarding() async {
    if (_onboardingCompleted) return;
    _onboardingCompleted = true;
    notifyListeners();
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.setBool(_onboardingKey, true);
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

  Future<void> setGenieHidden(bool hidden) async {
    if (_genieHidden == hidden) return;
    _genieHidden = hidden;
    notifyListeners();
    _prefs ??= await SharedPreferences.getInstance();
    await _prefs?.setBool(_genieHiddenKey, hidden);
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
  }) async {
    late final http.Response response;
    try {
      response = await http
          .post(
            Uri.parse('$_baseUrl/auth/login'),
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
        tx('Cấu hình máy chủ không hợp lệ. Vui lòng liên hệ quản trị viên.'),
      );
    } on Exception catch (error) {
      throw ApiException(
        tx(
          'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại.',
        ),
        errorCode: error.toString(),
      );
    }

    final login = LoginResponse.fromJson(mapOf(unwrapResponse(response)));
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
  Future<bool> refreshAccessToken() {
    // Screens load several endpoints at once, so an expired access token makes
    // them all get a 401 together. The backend rotates the refresh token on
    // every use and treats the old one as reuse, which revokes the whole
    // session - so every caller has to wait on a single refresh call.
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    final started = _runRefresh();
    _refreshInFlight = started;
    return started.whenComplete(() {
      if (identical(_refreshInFlight, started)) _refreshInFlight = null;
    });
  }

  Future<bool> _runRefresh() async {
    final token = refreshToken;
    if (token == null) {
      // Nothing left to refresh with, so the session is over - saying so
      // sends the app back to login instead of leaving every screen on an
      // error the user cannot retry out of.
      if (isLoggedIn) await logoutLocal();
      return false;
    }

    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/auth/refresh'),
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
    } on ApiException catch (error) {
      // Only a rejected refresh token ends the session; a server or network
      // hiccup must not sign the user out.
      final status = error.statusCode;
      if (status == 401 || status == 403) await logoutLocal();
      return false;
    } catch (_) {
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
