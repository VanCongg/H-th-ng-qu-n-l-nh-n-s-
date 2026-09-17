import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import 'app_containers.dart';
import 'basic_elements.dart';

class LeaveRequestCard extends StatelessWidget {
  const LeaveRequestCard({
    super.key,
    required this.request,
    required this.onCancel,
  });

  final LeaveRequest request;
  final VoidCallback? onCancel;

  @override
  Widget build(BuildContext context) {
    final color = statusColor(request.status);

    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIconBadge(
                icon: Icons.beach_access_rounded,
                color: color,
                size: 40,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  request.leaveType.name,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              StatusIcon.status(request.status),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Pill(
                label:
                    '${formatDate(request.startDate)} - ${formatDate(request.endDate)}',
                color: brandColor,
              ),
              Pill(
                label: '${request.totalDays.toStringAsFixed(1)} ${tx('ngày')}',
                color: accentColor,
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            request.reason,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: mutedTextColor,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (request.rejectionReason != null &&
              request.rejectionReason!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              tx('Lý do từ chối: {reason}', {
                'reason': request.rejectionReason!,
              }),
              style: TextStyle(color: dangerColor),
            ),
          ],
          if (onCancel != null) ...[
            const SizedBox(height: 10),
            Align(
              alignment: Alignment.centerRight,
              child: IconButton.filledTonal(
                tooltip: tx('Hủy đơn'),
                onPressed: onCancel,
                style: IconButton.styleFrom(
                  foregroundColor: dangerColor,
                  backgroundColor: dangerColor.withValues(alpha: 0.10),
                ),
                icon: const Icon(Icons.close_rounded),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
