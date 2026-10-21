import 'package:flutter/material.dart';

import 'brand_backdrop.dart';

/// Colors come from the theme, not from the global palette in `utils.dart`:
/// a pushed route is built once and kept, so a widget that only read the
/// globals would still be painted in the old palette after the user flips
/// the theme from inside that route. Reading the theme both registers the
/// dependency that rebuilds this screen and picks up the new colors.
class SubScreen extends StatelessWidget {
  const SubScreen({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: theme.scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: theme.colorScheme.surface.withValues(alpha: 0.92),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: BrandBackdrop(child: child),
    );
  }
}
