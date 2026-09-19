import 'dart:ui';

import 'package:flutter/material.dart';

/// The OmniHR logo, rendered from the same artwork as the web admin
/// (`OmniHR_WEB/src/components/BrandLogo`) and the launcher icons, so every
/// surface shows the identical mark instead of a hand-drawn approximation.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 48, this.showShadow = true});

  static const asset = 'assets/images/omnihr_logo.png';

  final double size;
  final bool showShadow;

  @override
  Widget build(BuildContext context) {
    final logo = Image.asset(
      asset,
      width: size,
      height: size,
      filterQuality: FilterQuality.high,
    );

    return Semantics(
      label: 'OmniHR',
      image: true,
      child: ExcludeSemantics(
        child: SizedBox.square(
          dimension: size,
          child: showShadow
              ? Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // Same soft teal drop shadow as the web logo.
                    Positioned(
                      left: 0,
                      top: size * 0.08,
                      child: ImageFiltered(
                        imageFilter: ImageFilter.blur(
                          sigmaX: size * 0.08,
                          sigmaY: size * 0.08,
                        ),
                        child: Image.asset(
                          asset,
                          width: size,
                          height: size,
                          color: const Color(
                            0xFF127195,
                          ).withValues(alpha: 0.28),
                          colorBlendMode: BlendMode.srcIn,
                        ),
                      ),
                    ),
                    logo,
                  ],
                )
              : logo,
        ),
      ),
    );
  }
}
