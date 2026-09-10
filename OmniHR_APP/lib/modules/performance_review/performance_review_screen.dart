import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';

class PerformanceReviewScreen extends StatefulWidget {
  const PerformanceReviewScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<PerformanceReviewScreen> createState() =>
      _PerformanceReviewScreenState();
}

class _PerformanceReviewScreenState extends State<PerformanceReviewScreen> {
  late Future<List<PerformanceReview>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<PerformanceReview>> _load() {
    return widget.session.api.getList(
      '/performance-reviews/self',
      PerformanceReview.fromJson,
      query: {'limit': 50},
    );
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _openSelfAssessment(PerformanceReview review) async {
    final commentController = TextEditingController();
    var rating = 4;
    var submitting = false;

    final submitted = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            Future<void> submit() async {
              setSheetState(() => submitting = true);
              try {
                await widget.session.api.patch(
                  '/performance-reviews/${review.id}/submit-self',
                  body: {
                    'selfRating': rating,
                    'selfComment': commentController.text.trim(),
                  },
                );
                if (context.mounted) Navigator.pop(context, true);
              } catch (error) {
                if (context.mounted) {
                  showAppSnack(context, error.toString(), error: true);
                }
              } finally {
                if (context.mounted) {
                  setSheetState(() => submitting = false);
                }
              }
            }

            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    tx('Tự đánh giá'),
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    review.cycle.name,
                    style: TextStyle(color: inkColor.withValues(alpha: 0.6)),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    tx('Mức độ hoàn thành'),
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  _RatingPicker(
                    value: rating,
                    onChanged: submitting
                        ? null
                        : (value) => setSheetState(() => rating = value),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: commentController,
                    minLines: 3,
                    maxLines: 5,
                    decoration: InputDecoration(
                      labelText: tx('Nhận xét của bạn'),
                      alignLabelWithHint: true,
                    ),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: submitting ? null : submit,
                    icon: submitting
                        ? const SizedBox.square(
                            dimension: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
                    label: Text(
                      tx(submitting ? 'Đang gửi...' : 'Gửi đánh giá'),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );

    commentController.dispose();
    if (submitted == true) {
      if (mounted) showAppSnack(context, tx('Đã gửi tự đánh giá.'));
      await _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<PerformanceReview>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final reviews = snapshot.data ?? const <PerformanceReview>[];
        final pending = reviews
            .where((item) => item.needsSelfAssessment)
            .length;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 104),
            children: [
              Pill(
                label: '$pending ${tx('chờ tự đánh giá')}',
                color: pending > 0 ? accentColor : brandGreen,
              ),
              const SizedBox(height: 14),
              if (reviews.isEmpty)
                EmptyState(
                  icon: Icons.star_outline_rounded,
                  title: tx('Chưa có kỳ đánh giá'),
                  body: tx('Khi công ty mở kỳ đánh giá, bạn sẽ thấy tại đây.'),
                )
              else
                ...reviews.map(
                  (review) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: _ReviewCard(
                      review: review,
                      onSelfAssess: review.needsSelfAssessment
                          ? () => _openSelfAssessment(review)
                          : null,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

String _statusLabel(String status) {
  switch (status) {
    case 'PENDING_SELF':
      return tx('Chờ bạn tự đánh giá');
    case 'SELF_SUBMITTED':
      return tx('Đã gửi, chờ quản lý');
    case 'MANAGER_REVIEWED':
      return tx('Quản lý đã đánh giá');
    case 'FINALIZED':
      return tx('Đã chốt');
    default:
      return status;
  }
}

Color _statusColor(String status) {
  switch (status) {
    case 'FINALIZED':
      return brandGreen;
    case 'PENDING_SELF':
      return accentColor;
    default:
      return brandColor;
  }
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review, this.onSelfAssess});

  final PerformanceReview review;
  final VoidCallback? onSelfAssess;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              AppIconBadge(
                icon: Icons.star_rounded,
                color: _statusColor(review.status),
                size: 38,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.cycle.name,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${formatDate(review.cycle.startDate)} - ${formatDate(review.cycle.endDate)}',
                      style: TextStyle(
                        fontSize: 12,
                        color: inkColor.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ),
              ),
              Pill(
                label: _statusLabel(review.status),
                color: _statusColor(review.status),
              ),
            ],
          ),
          if (review.selfRating != null ||
              review.managerRating != null ||
              review.finalRating != null) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (review.selfRating != null)
                  _ScoreChip(
                    label: tx('Tự đánh giá'),
                    value: review.selfRating!,
                  ),
                if (review.managerRating != null)
                  _ScoreChip(
                    label: tx('Quản lý'),
                    value: review.managerRating!,
                  ),
                if (review.finalRating != null)
                  _ScoreChip(
                    label: tx('Chốt'),
                    value: review.finalRating!,
                    highlight: true,
                  ),
              ],
            ),
          ],
          if (review.managerComment != null &&
              review.managerComment!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              tx('Nhận xét của quản lý'),
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 3),
            Text(
              review.managerComment!,
              style: TextStyle(color: inkColor.withValues(alpha: 0.72)),
            ),
          ],
          if (onSelfAssess != null) ...[
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: onSelfAssess,
              icon: const Icon(Icons.rate_review_outlined),
              label: Text(tx('Tự đánh giá ngay')),
            ),
          ],
        ],
      ),
    );
  }
}

class _ScoreChip extends StatelessWidget {
  const _ScoreChip({
    required this.label,
    required this.value,
    this.highlight = false,
  });

  final String label;
  final int value;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    final color = highlight ? brandGreen : brandColor;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: inkColor.withValues(alpha: 0.65),
            ),
          ),
          const SizedBox(width: 6),
          Text(
            '$value/5',
            style: TextStyle(fontWeight: FontWeight.w900, color: color),
          ),
        ],
      ),
    );
  }
}

class _RatingPicker extends StatelessWidget {
  const _RatingPicker({required this.value, this.onChanged});

  final int value;
  final ValueChanged<int>? onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(5, (index) {
        final score = index + 1;
        final selected = score <= value;
        return Expanded(
          child: GestureDetector(
            onTap: onChanged == null ? null : () => onChanged!(score),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 3),
              child: Column(
                children: [
                  Icon(
                    selected ? Icons.star_rounded : Icons.star_outline_rounded,
                    color: selected
                        ? accentColor
                        : inkColor.withValues(alpha: 0.28),
                    size: 34,
                  ),
                  Text(
                    '$score',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w500,
                      color: inkColor.withValues(alpha: selected ? 0.8 : 0.45),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }),
    );
  }
}
