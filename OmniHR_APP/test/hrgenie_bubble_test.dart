import 'dart:convert';

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
  testWidgets('dragging the genie off the side tucks it against the edge', (
    tester,
  ) async {
    final session = await signedInSession();
    await tester.pumpWidget(OmniHrApp(session: session));
    await tester.pumpAndSettle();

    final bubble = find.bySemanticsLabel('HRGenie');
    expect(bubble, findsOneWidget);
    // It parks itself bottom right, fully on screen.
    expect(tester.getRect(bubble).left, greaterThan(0));

    await tester.drag(bubble, const Offset(-900, 0));
    await tester.pumpAndSettle();

    expect(session.genieHidden, isTrue);
    final tucked = tester.getRect(find.bySemanticsLabel('Hiện trợ lý'));
    // Hidden means peeking, not gone: part of it stays within the screen.
    expect(tucked.left, lessThan(0));
    expect(tucked.right, greaterThan(0));
  });

  testWidgets('tapping the tucked genie brings it back in full', (
    tester,
  ) async {
    final session = await signedInSession();
    await session.setGenieHidden(true);
    await tester.pumpWidget(OmniHrApp(session: session));
    await tester.pumpAndSettle();

    final screen = tester.view.physicalSize / tester.view.devicePixelRatio;
    final tucked = tester.getRect(find.bySemanticsLabel('Hiện trợ lý'));
    // It parks bottom right, so its centre is past the right edge: tap the
    // sliver that still shows rather than the middle of the bubble.
    await tester.tapAt(Offset(tucked.left + 6, tucked.center.dy));
    await tester.pumpAndSettle();

    expect(session.genieHidden, isFalse);
    final back = tester.getRect(find.bySemanticsLabel('HRGenie'));
    expect(back.left, greaterThanOrEqualTo(0));
    expect(back.right, lessThanOrEqualTo(screen.width));
  });

  testWidgets('a tucked away genie stays tucked away on the next launch', (
    tester,
  ) async {
    final session = await signedInSession();
    await session.setGenieHidden(true);

    final relaunched = AppSession();
    await relaunched.bootstrap();

    expect(relaunched.genieHidden, isTrue);
  });
}
