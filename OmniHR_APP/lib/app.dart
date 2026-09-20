import 'core/i18n.dart';
import 'package:flutter/material.dart';

import 'core/session.dart';
import 'core/theme.dart';
import 'core/utils.dart';
import 'modules/auth/login_screen.dart';
import 'modules/onboarding/onboarding_screen.dart';
import 'modules/shell/home_shell.dart';
import 'shared/widgets/widgets.dart';

class OmniHrApp extends StatefulWidget {
  const OmniHrApp({super.key, required this.session});

  final AppSession session;

  @override
  State<OmniHrApp> createState() => _OmniHrAppState();
}

class _OmniHrAppState extends State<OmniHrApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  late bool _wasLoggedIn;

  @override
  void initState() {
    super.initState();
    // Read eagerly: a lazy `late` initialiser would first run inside the
    // listener, after the session had already gone, and miss the change.
    _wasLoggedIn = widget.session.isLoggedIn;
    widget.session.addListener(_onSessionChanged);
  }

  @override
  void dispose() {
    widget.session.removeListener(_onSessionChanged);
    super.dispose();
  }

  /// `home` swaps to the login screen on its own, but anything the user had
  /// pushed on top (a sub screen, a dialog, a bottom sheet) would stay there
  /// showing errors it can never recover from. Losing the session therefore
  /// unwinds the navigator back to the root route.
  void _onSessionChanged() {
    final loggedIn = widget.session.isLoggedIn;
    if (_wasLoggedIn && !loggedIn) {
      _navigatorKey.currentState?.popUntil((route) => route.isFirst);
    }
    _wasLoggedIn = loggedIn;
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;

    return AnimatedBuilder(
      animation: session,
      builder: (context, _) {
        return MaterialApp(
          title: 'OmniHR',
          debugShowCheckedModeBanner: false,
          navigatorKey: _navigatorKey,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: session.themeMode,
          home: session.bootstrapping
              ? const BootScreen()
              : session.isLoggedIn
              ? HomeShell(session: session)
              : !session.onboardingCompleted
              ? OnboardingScreen(session: session)
              : LoginScreen(session: session),
        );
      },
    );
  }
}

class BootScreen extends StatelessWidget {
  const BootScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: BrandBackdrop(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const LogoMark(size: 92),
              const SizedBox(height: 22),
              Text(
                'OmniHR',
                style: Theme.of(context).textTheme.displaySmall?.copyWith(
                  color: inkColor,
                  fontWeight: FontWeight.w900,
                  height: 0.95,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                tx('Con người là trọng tâm. Rõ ràng mỗi ngày.'),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: mutedTextColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 34),
              SizedBox(
                width: 190,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    minHeight: 4,
                    color: brandColor,
                    backgroundColor: Colors.white.withValues(alpha: 0.55),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
