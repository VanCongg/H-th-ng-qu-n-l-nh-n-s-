import 'package:flutter/material.dart';

import '../../core/utils.dart';
import 'chat_models.dart';

class PendingActionCard extends StatelessWidget {
  const PendingActionCard({
    super.key,
    required this.action,
    required this.busy,
    required this.onConfirm,
    required this.onCancel,
  });

  final PendingChatAction action;
  final bool busy;
  final VoidCallback onConfirm;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final summary = action.summary;
    final isCancelLeave = action.type == 'CANCEL_LEAVE_REQUEST';
    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 360),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: accentColor.withValues(alpha: 0.26)),
            boxShadow: [
              BoxShadow(
                color: accentColor.withValues(alpha: 0.12),
                blurRadius: 18,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Icon(Icons.fact_check_rounded, color: accentColor),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        action.title,
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _SummaryRow(
                  label: isCancelLeave ? 'Đơn hủy' : 'Loại nghỉ',
                  value: textOf(
                    summary['leaveType'],
                    textOf(summary['leaveTypeCode'], '-'),
                  ),
                ),
                _SummaryRow(
                  label: 'Từ ngày',
                  value: formatDate(summary['startDate']),
                ),
                _SummaryRow(
                  label: 'Đến ngày',
                  value: formatDate(summary['endDate']),
                ),
                _SummaryRow(
                  label: 'Số ngày',
                  value: textOf(summary['totalDays'], '-'),
                ),
                _SummaryRow(
                  label: 'Lý do',
                  value: textOf(summary['reason'], '-'),
                ),
                _SummaryRow(
                  label: 'Trạng thái',
                  value: textOf(summary['currentStatus'], 'Chờ xác nhận'),
                ),
                if (action.expiresAt != null)
                  _SummaryRow(
                    label: 'Hết hạn',
                    value: formatDateTime(action.expiresAt),
                  ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: busy ? null : onCancel,
                        icon: const Icon(Icons.close_rounded),
                        label: Text(isCancelLeave ? 'Không hủy' : 'Hủy'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: busy ? null : onConfirm,
                        icon: busy
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                            )
                            : const Icon(Icons.check_rounded),
                        label: Text(isCancelLeave ? 'Xác nhận hủy' : 'Xác nhận'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 78,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: mutedTextColor,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: inkColor,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
