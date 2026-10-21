import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';
import 'chat_screen.dart';

/// Opens the HRGenie chat with the genie coming out of its lamp: smoke puffs
/// out of the spout of the lamp drawn in [from] (global coordinates), the
/// genie rises out of it to the middle of the screen, and dissolves while the
/// chat fades in underneath. Without [from], or with animations turned off
/// on the device, the chat just fades in.
Future<void> openGenieChat(
  BuildContext context,
  AppSession session, {
  Rect? from,
}) {
  final reduceMotion = MediaQuery.of(context).disableAnimations;
  return Navigator.of(
    context,
  ).push(_GenieChatRoute(session: session, from: reduceMotion ? null : from));
}

/// Where the widget [context] belongs to sits on screen, or null before it
/// has been laid out.
Rect? globalRectOf(BuildContext? context) {
  final box = context?.findRenderObject();
  if (box is! RenderBox || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}

class _GenieChatRoute extends PageRoute<void> {
  _GenieChatRoute({required this.session, required this.from});

  final AppSession session;
  final Rect? from;

  // Not opaque: the home screen has to stay visible while the genie flies
  // over it and the chat is still fading in.
  @override
  bool get opaque => false;

  @override
  Color? get barrierColor => null;

  @override
  String? get barrierLabel => null;

  @override
  bool get maintainState => true;

  @override
  Duration get transitionDuration =>
      Duration(milliseconds: from == null ? 280 : 1100);

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 260);

  @override
  Widget buildPage(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
  ) {
    return ChatScreen(session: session);
  }

  @override
  Widget buildTransitions(
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    // The chat only starts to show once the genie is out of the lamp.
    final reveal = CurvedAnimation(
      parent: animation,
      curve: from == null
          ? Curves.easeOut
          : const Interval(0.45, 1, curve: Curves.easeOut),
    );
    final page = FadeTransition(
      opacity: reveal,
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.96, end: 1).animate(reveal),
        child: child,
      ),
    );
    if (from == null) return page;
    return Stack(
      fit: StackFit.expand,
      children: [
        page,
        IgnorePointer(
          child: _GenieFlight(animation: animation, from: from!),
        ),
      ],
    );
  }
}

/// The genie's way out of the lamp, drawn over the chat while it fades in.
class _GenieFlight extends StatelessWidget {
  const _GenieFlight({required this.animation, required this.from});

  final Animation<double> animation;
  final Rect from;

  /// Where the genie is at [rise] (0 at the spout, 1 where it stops): up
  /// first, then across to the middle, like smoke caught by a draught.
  static Offset _along(Offset spout, Offset land, double rise) {
    final control = Offset(lerpDouble(spout.dx, land.dx, 0.15)!, land.dy - 24);
    final u = 1 - rise;
    return spout * (u * u) + control * (2 * u * rise) + land * (rise * rise);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final screen = constraints.biggest;
        final spout = Offset(
          from.left + from.width * GenieLamp.spout.dx,
          from.top + from.height * GenieLamp.spout.dy,
        );
        final land = Offset(screen.width / 2, screen.height * 0.4);
        final startSize = from.shortestSide * 0.6;
        final endSize = math.min(170.0, screen.shortestSide * 0.45);

        return AnimatedBuilder(
          animation: animation,
          builder: (context, _) {
            // Going back to the home screen the chat just fades out; the
            // genie does not climb back into the lamp.
            if (animation.status == AnimationStatus.reverse) {
              return const SizedBox.shrink();
            }
            final t = animation.value;
            final rise = Curves.easeOutCubic.transform(_span(t, 0.08, 0.72));
            final dissolve = Curves.easeIn.transform(_span(t, 0.62, 1));
            final opacity = _span(t, 0.08, 0.2) * (1 - dissolve);

            final center = _along(spout, land, rise);
            // Grows as it comes out, and a little more as it melts away.
            final size =
                lerpDouble(startSize, endSize, rise)! * (1 + 0.3 * dissolve);
            final sway = math.sin(rise * math.pi * 2) * 0.14 * (1 - rise);

            return Stack(
              children: [
                Positioned.fill(
                  child: CustomPaint(
                    painter: _SmokePainter(
                      spout: spout,
                      land: land,
                      rise: rise,
                      puff: _span(t, 0, 0.35),
                      fade: _span(t, 0.35, 0.85),
                      scale: from.shortestSide / 48,
                      color: brandColor,
                    ),
                  ),
                ),
                if (opacity > 0)
                  Positioned(
                    left: center.dx - size / 2,
                    top: center.dy - size / 2,
                    child: Opacity(
                      opacity: opacity,
                      child: Transform.rotate(
                        angle: sway,
                        child: GenieFigure(size: size),
                      ),
                    ),
                  ),
              ],
            );
          },
        );
      },
    );
  }
}

/// How far [t] is between [begin] and [end], clamped to 0..1.
double _span(double t, double begin, double end) =>
    ((t - begin) / (end - begin)).clamp(0.0, 1.0).toDouble();

/// A puff of smoke bursting out of the spout, and a trail of it left behind
/// the rising genie that thins out as the chat comes in.
class _SmokePainter extends CustomPainter {
  const _SmokePainter({
    required this.spout,
    required this.land,
    required this.rise,
    required this.puff,
    required this.fade,
    required this.scale,
    required this.color,
  });

  final Offset spout;
  final Offset land;
  final double rise;
  final double puff;
  final double fade;
  final double scale;
  final Color color;

  static const _smoke = Color(0xFF74C0FC);

  @override
  void paint(Canvas canvas, Size size) {
    final visible = 1 - fade;
    if (visible <= 0) return;

    // The burst: three rings of smoke swelling out of the spout.
    if (puff < 1) {
      for (var i = 0; i < 3; i++) {
        final angle = -math.pi / 2 + (i - 1) * 0.9;
        final reach = 14 * scale * puff;
        canvas.drawCircle(
          spout + Offset(math.cos(angle), math.sin(angle)) * reach,
          (4 + 10 * puff) * scale,
          Paint()..color = _smoke.withValues(alpha: 0.4 * (1 - puff)),
        );
      }
    }

    // The trail: puffs along the way the genie took, bigger further up.
    const count = 12;
    for (var i = 0; i < count; i++) {
      final s = rise * i / count;
      final point = _GenieFlight._along(spout, land, s);
      final radius = (3 + 16 * s) * scale;
      final wobble = math.sin(i * 1.7) * 4 * scale;
      canvas.drawCircle(
        point + Offset(wobble, 0),
        radius,
        Paint()
          ..color = Color.lerp(
            _smoke,
            color,
            s,
          )!.withValues(alpha: 0.28 * visible * (1 - s * 0.5))
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, radius * 0.5),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _SmokePainter oldDelegate) =>
      oldDelegate.rise != rise ||
      oldDelegate.puff != puff ||
      oldDelegate.fade != fade ||
      oldDelegate.spout != spout ||
      oldDelegate.land != land ||
      oldDelegate.color != color;
}
