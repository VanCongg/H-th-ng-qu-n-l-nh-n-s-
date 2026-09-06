import 'package:flutter/material.dart';

import 'core/session.dart';
import 'core/theme.dart';
import 'core/utils.dart';
import 'modules/auth/login_screen.dart';
import 'modules/shell/home_shell.dart';
import 'shared/widgets/widgets.dart';

class OmniHrApp extends StatelessWidget {
  const OmniHrApp({super.key, required this.session});

  final AppSession session;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: session,
      builder: (context, _) {
        return MaterialApp(
          title: 'OmniHR',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: session.themeMode,
          home: session.bootstrapping
              ? const BootScreen()
              : session.isLoggedIn
              ? HomeShell(session: session)
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
                'People first. Clarity every day.',
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
