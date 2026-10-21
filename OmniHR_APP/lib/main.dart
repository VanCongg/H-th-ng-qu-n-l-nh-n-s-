// Điểm khởi động app mobile cho nhân viên: tạo phiên (AppSession), chạy OmniHrApp,
// rồi đọc lại phiên đã lưu ở nền (bootstrap).

import 'dart:async';

import 'package:flutter/widgets.dart';

import 'app.dart';
import 'core/session.dart';

export 'app.dart';
export 'core/session.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  final session = AppSession();
  runApp(OmniHrApp(session: session));
  unawaited(session.bootstrap());
}
