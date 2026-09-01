import 'package:flutter/material.dart';

import 'core/session.dart';
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
          theme: _buildTheme(),
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

ThemeData _buildTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: brandColor,
      brightness: Brightness.light,
    ),
  );

  return base.copyWith(
    colorScheme: base.colorScheme.copyWith(
      primary: brandColor,
      secondary: brandGreen,
      tertiary: accentColor,
      surface: Colors.white,
      onSurface: inkColor,
      error: dangerColor,
    ),
    scaffoldBackgroundColor: appBackgroundColor,
    textTheme: base.textTheme.apply(
      bodyColor: inkColor,
      displayColor: inkColor,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: appBackgroundColor,
      foregroundColor: inkColor,
      centerTitle: false,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      surfaceTintColor: Colors.transparent,
      shadowColor: const Color(0xFF101828).withValues(alpha: 0.08),
      shape: RoundedRectangleBorder(
        side: BorderSide(color: brandColor.withValues(alpha: 0.12)),
        borderRadius: BorderRadius.circular(8),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        backgroundColor: brandColor,
        foregroundColor: Colors.white,
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(48),
        foregroundColor: brandColor,
        side: BorderSide(color: brandColor.withValues(alpha: 0.24)),
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: brandColor,
        textStyle: const TextStyle(fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        visualDensity: VisualDensity.compact,
        foregroundColor: WidgetStateProperty.resolveWith(
          (states) =>
              states.contains(WidgetState.selected) ? Colors.white : brandColor,
        ),
        backgroundColor: WidgetStateProperty.resolveWith(
          (states) => states.contains(WidgetState.selected)
              ? brandColor
              : Colors.transparent,
        ),
        side: WidgetStateProperty.all(
          BorderSide(color: brandColor.withValues(alpha: 0.18)),
        ),
        textStyle: WidgetStateProperty.all(
          const TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: brandColor, width: 1.4),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: dangerColor),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: brandColor.withValues(alpha: 0.12),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected)
              ? brandColor
              : mutedTextColor,
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w600,
        ),
      ),
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => IconThemeData(
          color: states.contains(WidgetState.selected)
              ? brandColor
              : mutedTextColor,
        ),
      ),
    ),
  );
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
