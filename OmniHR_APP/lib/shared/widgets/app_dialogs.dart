import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/utils.dart';
import 'app_containers.dart';

/// Actions laid out on one row, each taking half the width.
///
/// `AlertDialog` arranges `actions` in an `OverflowBar`, which drops them into
/// a vertical stack as soon as they do not fit side by side. Vietnamese labels
/// are long enough to trigger that on a narrow phone, so the buttons are built
/// here instead of handed to `actions`.
class _DialogActions extends StatelessWidget {
  const _DialogActions({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final row = <Widget>[];
    for (var index = 0; index < children.length; index++) {
      if (index > 0) row.add(const SizedBox(width: 10));
      row.add(Expanded(child: children[index]));
    }
    return Row(children: row);
  }
}

/// Asks the user to confirm, and resolves to false when the sheet is dismissed
/// by tapping outside or going back.
Future<bool> showAppConfirm(
  BuildContext context, {
  required IconData icon,
  required String title,
  required String message,
  required String confirmLabel,
  String? cancelLabel,
  Color? color,
  bool destructive = false,
}) async {
  final accent = color ?? (destructive ? dangerColor : brandColor);
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) {
      return AlertDialog(
        icon: AppIconBadge(icon: icon, color: accent, size: 54),
        title: Text(title, textAlign: TextAlign.center),
        content: Text(message, textAlign: TextAlign.center),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
        actions: [
          _DialogActions(
            children: [
              OutlinedButton(
                onPressed: () => Navigator.pop(context, false),
                child: Text(cancelLabel ?? tx('Hủy')),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                style: destructive
                    ? FilledButton.styleFrom(backgroundColor: dangerColor)
                    : null,
                child: Text(confirmLabel),
              ),
            ],
          ),
        ],
      );
    },
  );
  return confirmed == true;
}

/// Tells the user something went wrong and offers nothing but a way out.
Future<void> showAppAlert(
  BuildContext context, {
  required IconData icon,
  required String title,
  required String message,
  Color? color,
  String? dismissLabel,
}) {
  return showDialog<void>(
    context: context,
    builder: (context) {
      return AlertDialog(
        icon: AppIconBadge(icon: icon, color: color ?? dangerColor, size: 54),
        title: Text(title, textAlign: TextAlign.center),
        content: Text(message, textAlign: TextAlign.center),
        actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
        actions: [
          _DialogActions(
            children: [
              FilledButton(
                onPressed: () => Navigator.pop(context),
                child: Text(dismissLabel ?? tx('Đã hiểu')),
              ),
            ],
          ),
        ],
      );
    },
  );
}

/// The same one-row action layout for a dialog that owns its own body, such as
/// a form that must stay mounted while it submits.
class AppDialogActions extends StatelessWidget {
  const AppDialogActions({super.key, required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) => _DialogActions(children: children);
}
