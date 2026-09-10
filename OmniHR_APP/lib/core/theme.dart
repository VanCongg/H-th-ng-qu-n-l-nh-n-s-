import 'package:flutter/material.dart';

/// Two color sets only: [light] and [dark]. Every screen reads colors via
/// `Theme.of(context).colorScheme` (or the [AppColorsX] shortcut) instead of
/// hardcoded constants, so toggling theme mode repaints the whole app.
abstract class AppTheme {
  static const _brandBlue = Color(0xFF228BE6);
  static const _brandGreen = Color(0xFF12B886);
  static const _brandOrange = Color(0xFFF59F00);
  static const _brandRed = Color(0xFFDC2626);

  static ThemeData get light => _build(
    brightness: Brightness.light,
    primary: _brandBlue,
    secondary: _brandGreen,
    tertiary: _brandOrange,
    error: _brandRed,
    surface: const Color(0xFFFFFFFF),
    onSurface: const Color(0xFF182230),
    onSurfaceVariant: const Color(0xFF667085),
    outline: const Color(0xFFE5E7EB),
    scaffoldBackground: const Color(0xFFF5F7FB),
  );

  static ThemeData get dark => _build(
    brightness: Brightness.dark,
    primary: const Color(0xFF4DABF7),
    secondary: const Color(0xFF3DDC97),
    tertiary: const Color(0xFFFFC078),
    error: const Color(0xFFEF4444),
    surface: const Color(0xFF1E293B),
    onSurface: const Color(0xFFF1F5F9),
    onSurfaceVariant: const Color(0xFF94A3B8),
    outline: const Color(0xFF334155),
    scaffoldBackground: const Color(0xFF0F172A),
  );

  static ThemeData _build({
    required Brightness brightness,
    required Color primary,
    required Color secondary,
    required Color tertiary,
    required Color error,
    required Color surface,
    required Color onSurface,
    required Color onSurfaceVariant,
    required Color outline,
    required Color scaffoldBackground,
  }) {
    final colorScheme =
        ColorScheme.fromSeed(
          seedColor: primary,
          brightness: brightness,
        ).copyWith(
          primary: primary,
          secondary: secondary,
          tertiary: tertiary,
          error: error,
          surface: surface,
          onSurface: onSurface,
          onSurfaceVariant: onSurfaceVariant,
          outline: outline,
        );

    final base = ThemeData(useMaterial3: true, colorScheme: colorScheme);

    return base.copyWith(
      scaffoldBackgroundColor: scaffoldBackground,
      textTheme: base.textTheme.apply(
        bodyColor: onSurface,
        displayColor: onSurface,
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: scaffoldBackground,
        foregroundColor: onSurface,
        centerTitle: false,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      cardTheme: CardThemeData(
        elevation: 0,
        color: surface,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.black.withValues(alpha: 0.08),
        shape: RoundedRectangleBorder(
          side: BorderSide(color: primary.withValues(alpha: 0.12)),
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          backgroundColor: primary,
          foregroundColor: Colors.white,
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(48),
          foregroundColor: primary,
          side: BorderSide(color: primary.withValues(alpha: 0.24)),
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: primary,
          textStyle: const TextStyle(fontWeight: FontWeight.w800),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          visualDensity: VisualDensity.compact,
          foregroundColor: WidgetStateProperty.resolveWith(
            (states) =>
                states.contains(WidgetState.selected) ? Colors.white : primary,
          ),
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected)
                ? primary
                : Colors.transparent,
          ),
          side: WidgetStateProperty.all(
            BorderSide(color: primary.withValues(alpha: 0.18)),
          ),
          textStyle: WidgetStateProperty.all(
            const TextStyle(fontWeight: FontWeight.w800),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 14,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: primary, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: error),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: surface,
        indicatorColor: primary.withValues(alpha: 0.12),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(WidgetState.selected)
                ? primary
                : onSurfaceVariant,
            fontSize: 12,
            fontWeight: states.contains(WidgetState.selected)
                ? FontWeight.w800
                : FontWeight.w600,
          ),
        ),
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? primary
                : onSurfaceVariant,
          ),
        ),
      ),
    );
  }
}

/// Shortcut so widgets can write `context.colors.primary` instead of
/// `Theme.of(context).colorScheme.primary`.
extension AppColorsX on BuildContext {
  ColorScheme get colors => Theme.of(this).colorScheme;
}
