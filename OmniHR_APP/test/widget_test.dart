import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/main.dart';

void main() {
  testWidgets('shows login screen when no session exists', (tester) async {
    final session = AppSession(bootstrapping: false);

    await tester.pumpWidget(OmniHrApp(session: session));

    expect(find.text('OmniHR'), findsOneWidget);
    expect(find.text('Login'), findsOneWidget);
  });
}
