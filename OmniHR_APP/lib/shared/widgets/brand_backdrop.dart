import 'package:flutter/material.dart';

import '../../core/utils.dart';

/// App background, matching the web admin shell: a plain neutral page with a
/// faint blue tint that fades out within the first screen. The old full-height
/// green wash, rainbow stripe and decorative circles made every screen look
/// tinted and busy.
class BrandBackdrop extends StatelessWidget {
  const BrandBackdrop({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;

    return ColoredBox(
      color: appBackgroundColor,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: 620,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    // Web: rgba(25,113,194,.08) -> rgba(18,184,134,.04) at 340px
                    // (dark: .20 blue -> .12 violet at 360px) -> transparent.
                    colors: dark
                        ? [
                            const Color(0xFF1971C2).withValues(alpha: 0.20),
                            const Color(0xFF7048E8).withValues(alpha: 0.12),
                            Colors.transparent,
                          ]
                        : [
                            const Color(0xFF1971C2).withValues(alpha: 0.08),
                            const Color(0xFF12B886).withValues(alpha: 0.04),
                            Colors.transparent,
                          ],
                    stops: dark ? const [0, 0.58, 1] : const [0, 0.55, 1],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(padding: padding, child: child),
          ),
        ],
      ),
    );
  }
}
