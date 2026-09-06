import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/utils.dart';
import 'logo_mark.dart';

/// A frosted-glass header: fixed (never scrolls), so the [BackdropFilter]
/// blur is cheap here — it repaints only on theme change or route
/// transition, not on every scroll frame.
class AppHeaderBar extends StatelessWidget {
  const AppHeaderBar({
    super.key,
    required this.title,
    this.subtitle,
    this.actions = const [],
  });

  final String title;
  final String? subtitle;
  final List<Widget> actions;

  /// Fixed height so callers that overlay this bar over scrollable content
  /// (for a real glass effect) know how much top padding to reserve.
  static const double preferredHeight = 76;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
        child: Container(
          height: preferredHeight,
          decoration: BoxDecoration(
            color: surfaceColor.withValues(alpha: 0.72),
            border: Border(
              bottom: BorderSide(color: brandColor.withValues(alpha: 0.10)),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Row(
              children: [
                const LogoMark(size: 30, showShadow: false),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(
                          context,
                        ).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(
                            context,
                          ).textTheme.bodySmall?.copyWith(
                            color: mutedTextColor,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (actions.isNotEmpty) ...actions,
              ],
            ),
          ),
        ),
      ),
    );
  }
}
