import 'package:flutter/foundation.dart';

class AppConfig {
  const AppConfig._();

  /// Backend URL baked in at build time, e.g.
  /// `flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com`.
  /// It is intentionally not user-editable or shown in the UI.
  static const _apiBaseUrlOverride = String.fromEnvironment('API_BASE_URL');

  static String defaultApiBaseUrl() {
    if (_apiBaseUrlOverride.isNotEmpty) return _apiBaseUrlOverride;
    if (kIsWeb) return 'http://localhost:3000';
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }
}
