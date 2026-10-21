import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/main.dart';
import 'package:omnihr_app/modules/onboarding/onboarding_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('shows login screen when no session exists', (tester) async {
    final session = AppSession(bootstrapping: false, onboardingCompleted: true);

    await tester.pumpWidget(OmniHrApp(session: session));

    expect(find.text('OmniHR'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsWidgets);
    expect(find.byIcon(Icons.dns_outlined), findsNothing);
  });

  testWidgets('first launch walks splash, guide and permissions to login', (
    tester,
  ) async {
    final session = AppSession(bootstrapping: false);

    await tester.pumpWidget(OmniHrApp(session: session));
    expect(find.text('Chạm để tiếp tục'), findsOneWidget);

    await tester.tap(find.text('Chạm để tiếp tục'));
    await tester.pumpAndSettle();
    expect(find.text('Chấm công bằng GPS'), findsOneWidget);

    await tester.tap(find.text('Tiếp theo'));
    await tester.pumpAndSettle();
    expect(find.text('Xin nghỉ phép nhanh'), findsOneWidget);

    await tester.tap(find.text('Bỏ qua'));
    await tester.pumpAndSettle();
    expect(find.text('Cấp quyền cho ứng dụng'), findsOneWidget);

    await tester.tap(find.text('Để sau'));
    await tester.pumpAndSettle();
    expect(session.onboardingCompleted, isTrue);
    expect(find.text('Sử dụng tài khoản OmniHR để tiếp tục.'), findsOneWidget);
  });

  testWidgets('splash auto-advances and allowing requests permissions', (
    tester,
  ) async {
    final session = AppSession(bootstrapping: false);
    var permissionRequests = 0;

    await tester.pumpWidget(
      MaterialApp(
        home: OnboardingScreen(
          session: session,
          splashDuration: const Duration(seconds: 1),
          requestPermissions: () async {
            permissionRequests++;
            return true;
          },
        ),
      ),
    );

    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(find.text('Chấm công bằng GPS'), findsOneWidget);

    await tester.tap(find.text('Bỏ qua'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cho phép và tiếp tục'));
    await tester.pump();

    expect(permissionRequests, 1);
    expect(session.onboardingCompleted, isTrue);
  });
}
