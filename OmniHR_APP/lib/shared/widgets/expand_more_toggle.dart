import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/utils.dart';

/// Shows [collapsed] always, and reveals [expandedExtra] behind a
/// "show more" toggle instead of rendering every item at once.
class ExpandMoreToggle extends StatefulWidget {
  const ExpandMoreToggle({
    super.key,
    required this.collapsed,
    required this.expandedExtra,
    required this.expandLabel,
    this.collapseLabel = 'Thu gọn',
  });

  final Widget collapsed;
  final Widget expandedExtra;
  final String expandLabel;
  final String collapseLabel;

  @override
  State<ExpandMoreToggle> createState() => _ExpandMoreToggleState();
}

class _ExpandMoreToggleState extends State<ExpandMoreToggle> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        widget.collapsed,
        AnimatedSize(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          child: _open ? widget.expandedExtra : const SizedBox.shrink(),
        ),
        Align(
          alignment: Alignment.centerRight,
          child: TextButton.icon(
            onPressed: () => setState(() => _open = !_open),
            icon: AnimatedRotation(
              turns: _open ? 0.5 : 0,
              duration: const Duration(milliseconds: 200),
              child: const Icon(Icons.expand_more_rounded, size: 20),
            ),
            label: Text(
              tx(_open ? widget.collapseLabel : widget.expandLabel),
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: mutedTextColor,
              ),
            ),
            style: TextButton.styleFrom(foregroundColor: mutedTextColor),
          ),
        ),
      ],
    );
  }
}
