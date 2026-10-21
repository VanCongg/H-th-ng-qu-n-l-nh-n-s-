import 'package:flutter/material.dart';

import '../../core/i18n.dart';

/// Previous / current month / next header, shared by the screens that page
/// through data a month at a time.
class MonthSwitcher extends StatelessWidget {
  const MonthSwitcher({
    super.key,
    required this.visibleMonth,
    required this.onPreviousMonth,
    required this.onNextMonth,
  });

  final DateTime visibleMonth;
  final VoidCallback onPreviousMonth;
  final VoidCallback onNextMonth;

  @override
  Widget build(BuildContext context) {
    final title = tx('Tháng {month}/{year}', {
      'month': visibleMonth.month.toString().padLeft(2, '0'),
      'year': '${visibleMonth.year}',
    });

    return Row(
      children: [
        IconButton(
          tooltip: tx('Tháng trước'),
          onPressed: onPreviousMonth,
          icon: const Icon(Icons.chevron_left_rounded),
        ),
        Expanded(
          child: Text(
            title,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w900),
          ),
        ),
        IconButton(
          tooltip: tx('Tháng sau'),
          onPressed: onNextMonth,
          icon: const Icon(Icons.chevron_right_rounded),
        ),
      ],
    );
  }
}
