import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:omnihr_app/core/i18n.dart';
import 'package:omnihr_app/core/session.dart';
import 'package:omnihr_app/core/theme.dart';
import 'package:omnihr_app/core/utils.dart';
import 'package:omnihr_app/modules/settings/settings_screen.dart';
import 'package:omnihr_app/shared/widgets/widgets.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Settings is the screen that flips the theme and the language, and it runs
/// inside a pushed route. A route that keeps handing back the same widget
/// instance is skipped by the element tree, so the screen has to pick up the
/// new palette and the new language on its own.
void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
    applyAppBrightness(Brightness.light);
    currentLanguage = AppLanguage.vi;
  });

  tearDown(() {
    applyAppBrightness(Brightness.light);
    currentLanguage = AppLanguage.vi;
  });

  /// Mirrors how the dashboard opens the screen. [prebuilt] reproduces the
  /// worst case, where the route was handed a widget built once and for all.
  Future<void> pumpSettingsRoute(
    WidgetTester tester,
    AppSession session, {
    bool prebuilt = false,
  }) async {
    SubScreen buildScreen() => SubScreen(
      title: tx('Cài đặt'),
      child: SettingsScreen(session: session),
    );
    final cached = buildScreen();

    await tester.pumpWidget(
      AnimatedBuilder(
        animation: session,
        builder: (context, _) => MaterialApp(
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: session.themeMode,
          home: Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => prebuilt ? cached : buildScreen(),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  Color panelColor(WidgetTester tester) {
    final container = tester.widget<Container>(
      find.descendant(
        of: find.byType(AppPanel),
        matching: find.byType(Container),
      ),
    );
    return (container.decoration! as BoxDecoration).color!;
  }

  testWidgets('turning on dark mode repaints the open settings route', (
    tester,
  ) async {
    final session = AppSession(bootstrapping: false, onboardingCompleted: true);
    await pumpSettingsRoute(tester, session, prebuilt: true);

    expect(panelColor(tester), AppTheme.light.colorScheme.surface);

    await tester.tap(find.byType(SwitchListTile));
    await tester.pumpAndSettle();

    expect(session.themeMode, ThemeMode.dark);
    // The switch and its icon follow the session instead of staying where
    // the route first built them.
    expect(
      tester.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
      isTrue,
    );
    expect(find.byIcon(Icons.dark_mode_rounded), findsOneWidget);
    // The row names the mode the app is in, so it flips with the switch.
    expect(find.text('Giao diện tối'), findsOneWidget);
    // Panel and scaffold move to the dark palette, so the text - which does
    // turn light with the theme - never lands on a leftover light surface.
    expect(panelColor(tester), AppTheme.dark.colorScheme.surface);
    expect(
      tester.widget<Scaffold>(find.byType(Scaffold).last).backgroundColor,
      AppTheme.dark.scaffoldBackgroundColor,
    );
  });

  testWidgets('switching language relabels the open settings route', (
    tester,
  ) async {
    final session = AppSession(bootstrapping: false, onboardingCompleted: true);
    await pumpSettingsRoute(tester, session);

    expect(find.text('Giao diện sáng'), findsOneWidget);

    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();

    expect(session.language, AppLanguage.en);
    expect(find.text('Light theme'), findsOneWidget);
    expect(find.text('Giao diện sáng'), findsNothing);
    // The header comes from the route, so it has to follow too.
    expect(find.text('Settings'), findsOneWidget);
  });
}
