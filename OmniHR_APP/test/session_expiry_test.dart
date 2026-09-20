import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/app.dart';
import 'package:omnihr_app/core/session.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _user = {
  'id': 1,
  'username': 'ngoclb',
  'email': 'ngoclb@omnihr.local',
  'roles': ['EMPLOYEE'],
  'permissions': ['EMPLOYEE_READ_SELF'],
  'employeeId': 3,
};

Future<AppSession> signedInSession() async {
  SharedPreferences.setMockInitialValues({'onboardingCompleted': true});
  FlutterSecureStorage.setMockInitialValues({
    'accessToken': 'access-token',
    'refreshToken': 'refresh-token',
    'authUser': jsonEncode(_user),
  });
  final session = AppSession();
  await session.bootstrap();
  return session;
}

void main() {
  testWidgets('losing the session closes pushed screens and shows login', (
    tester,
  ) async {
    final session = await signedInSession();
    expect(session.isLoggedIn, isTrue);

    await tester.pumpWidget(OmniHrApp(session: session));
    await tester.pumpAndSettle();

    final navigator = tester.state<NavigatorState>(find.byType(Navigator));
    navigator.push(
      MaterialPageRoute<void>(
        builder: (_) => const Scaffold(body: Text('Màn hình con')),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Màn hình con'), findsOneWidget);

    await session.logoutLocal();
    await tester.pumpAndSettle();

    expect(find.text('Màn hình con'), findsNothing);
    expect(find.text('Đăng nhập'), findsWidgets);
  });

  testWidgets('a session with no refresh token left signs itself out', (
    tester,
  ) async {
    final session = await signedInSession();
    session.refreshToken = null;

    final refreshed = await session.refreshAccessToken();

    expect(refreshed, isFalse);
    expect(session.isLoggedIn, isFalse);
  });
}
