import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/attendance_location.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';

/// First-launch flow shown before login: an intro splash, a short usage
/// guide, then a request for the permissions the app needs. Finishing (or
/// skipping) it marks onboarding as done on the session so it never reappears.
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({
    super.key,
    required this.session,
    this.requestPermissions = requestLocationPermission,
    this.splashDuration = const Duration(milliseconds: 2600),
  });

  final AppSession session;
  final Future<bool> Function() requestPermissions;
  final Duration splashDuration;

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

enum _OnboardingStage { splash, guide, permissions }

class _GuideItem {
  const _GuideItem({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;
}

class _OnboardingScreenState extends State<OnboardingScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..forward();
  final _pageController = PageController();
  Timer? _splashTimer;
  var _stage = _OnboardingStage.splash;
  var _page = 0;
  var _requesting = false;

  List<_GuideItem> get _guideItems => [
    _GuideItem(
      icon: Icons.location_on_outlined,
      title: tx('Chấm công bằng GPS'),
      body: tx(
        'Mở tab Chấm công và bấm Vào ca / Ra ca khi đang ở văn phòng. Ứng dụng '
        'tự kiểm tra bạn có trong phạm vi cho phép.',
      ),
    ),
    _GuideItem(
      icon: Icons.event_available_outlined,
      title: tx('Xin nghỉ phép nhanh'),
      body: tx(
        'Tạo đơn trong tab Nghỉ phép, theo dõi số ngày phép còn lại và trạng '
        'thái duyệt của quản lý.',
      ),
    ),
    _GuideItem(
      icon: Icons.task_alt_rounded,
      title: tx('Theo dõi công việc'),
      body: tx(
        'Tab Công việc hiển thị việc được giao, hạn hoàn thành và cho phép bạn '
        'cập nhật tiến độ.',
      ),
    ),
    _GuideItem(
      icon: Icons.auto_awesome_outlined,
      title: tx('Hỏi HRGenie'),
      body: tx(
        'Trợ lý HRGenie trả lời câu hỏi về chấm công, nghỉ phép, công việc và '
        'có thể soạn đơn giúp bạn. Mọi thao tác đều cần bạn xác nhận.',
      ),
    ),
  ];

  @override
  void initState() {
    super.initState();
    _splashTimer = Timer(
      widget.splashDuration,
      () => _goTo(_OnboardingStage.guide),
    );
  }

  @override
  void dispose() {
    _splashTimer?.cancel();
    _intro.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _goTo(_OnboardingStage stage) {
    _splashTimer?.cancel();
    if (!mounted || _stage == stage) return;
    setState(() => _stage = stage);
  }

  Future<void> _allowPermissions() async {
    setState(() => _requesting = true);
    await widget.requestPermissions();
    await widget.session.completeOnboarding();
  }

  @override
  Widget build(BuildContext context) {
    final Widget content = switch (_stage) {
      _OnboardingStage.splash => _buildSplash(context),
      _OnboardingStage.guide => _buildGuide(context),
      _OnboardingStage.permissions => _buildPermissions(context),
    };

    return Scaffold(
      body: BrandBackdrop(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 350),
              child: KeyedSubtree(key: ValueKey(_stage), child: content),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSplash(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final fade = CurvedAnimation(
      parent: _intro,
      curve: const Interval(0.35, 1, curve: Curves.easeOut),
    );

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () => _goTo(_OnboardingStage.guide),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ScaleTransition(
                        scale: CurvedAnimation(
                          parent: _intro,
                          curve: Curves.easeOutBack,
                        ),
                        child: const LogoMark(size: 104),
                      ),
                      const SizedBox(height: 24),
                      FadeTransition(
                        opacity: fade,
                        child: Column(
                          children: [
                            Text(
                              'OmniHR',
                              style: textTheme.displaySmall?.copyWith(
                                color: inkColor,
                                fontWeight: FontWeight.w900,
                                height: 0.95,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Text(
                              tx('Con người là trọng tâm. Rõ ràng mỗi ngày.'),
                              textAlign: TextAlign.center,
                              style: textTheme.titleSmall?.copyWith(
                                color: brandColor,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              tx(
                                'Chấm công, nghỉ phép, công việc và hồ sơ cá '
                                'nhân trên một ứng dụng.',
                              ),
                              textAlign: TextAlign.center,
                              style: textTheme.bodyMedium?.copyWith(
                                color: mutedTextColor,
                                fontWeight: FontWeight.w600,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            FadeTransition(
              opacity: fade,
              child: Text(
                tx('Chạm để tiếp tục'),
                style: textTheme.labelMedium?.copyWith(
                  color: mutedTextColor,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuide(BuildContext context) {
    final items = _guideItems;
    final isLast = _page == items.length - 1;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () => _goTo(_OnboardingStage.permissions),
              child: Text(tx('Bỏ qua')),
            ),
          ),
          Expanded(
            child: PageView.builder(
              controller: _pageController,
              itemCount: items.length,
              onPageChanged: (index) => setState(() => _page = index),
              itemBuilder: (context, index) => _GuidePage(item: items[index]),
            ),
          ),
          _PageDots(count: items.length, index: _page),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: isLast
                ? () => _goTo(_OnboardingStage.permissions)
                : () => _pageController.nextPage(
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOut,
                  ),
            child: Text(tx(isLast ? 'Bắt đầu' : 'Tiếp theo')),
          ),
        ],
      ),
    );
  }

  Widget _buildPermissions(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const _IconBadge(icon: Icons.verified_user_outlined),
                    const SizedBox(height: 24),
                    Text(
                      tx('Cấp quyền cho ứng dụng'),
                      textAlign: TextAlign.center,
                      style: textTheme.headlineSmall?.copyWith(
                        color: inkColor,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      tx(
                        'OmniHR cần quyền sau để tính năng hoạt động chính xác. '
                        'Bạn có thể thay đổi bất cứ lúc nào trong cài đặt '
                        'thiết bị.',
                      ),
                      textAlign: TextAlign.center,
                      style: textTheme.bodyMedium?.copyWith(
                        color: mutedTextColor,
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 24),
                    _PermissionTile(
                      icon: Icons.location_on_outlined,
                      title: tx('Vị trí (GPS)'),
                      body: tx(
                        'Xác nhận bạn đang ở văn phòng khi chấm công. Vị trí '
                        'chỉ được lấy lúc bạn bấm Vào ca / Ra ca.',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          FilledButton.icon(
            onPressed: _requesting ? null : _allowPermissions,
            icon: _requesting
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.check_rounded),
            label: Text(tx('Cho phép và tiếp tục')),
          ),
          const SizedBox(height: 8),
          TextButton(
            onPressed: _requesting ? null : widget.session.completeOnboarding,
            child: Text(tx('Để sau')),
          ),
        ],
      ),
    );
  }
}

class _GuidePage extends StatelessWidget {
  const _GuidePage({required this.item});

  final _GuideItem item;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _IconBadge(icon: item.icon),
            const SizedBox(height: 32),
            Text(
              item.title,
              textAlign: TextAlign.center,
              style: textTheme.headlineSmall?.copyWith(
                color: inkColor,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              item.body,
              textAlign: TextAlign.center,
              style: textTheme.bodyMedium?.copyWith(
                color: mutedTextColor,
                fontWeight: FontWeight.w600,
                height: 1.45,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _IconBadge extends StatelessWidget {
  const _IconBadge({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 128,
      height: 128,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: brandColor.withValues(alpha: 0.10),
        border: Border.all(color: brandColor.withValues(alpha: 0.18)),
      ),
      child: Icon(icon, size: 58, color: brandColor),
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            margin: const EdgeInsets.symmetric(horizontal: 4),
            width: i == index ? 22 : 8,
            height: 8,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(999),
              color: i == index
                  ? brandColor
                  : brandColor.withValues(alpha: 0.2),
            ),
          ),
      ],
    );
  }
}

class _PermissionTile extends StatelessWidget {
  const _PermissionTile({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: surfaceColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: brandColor.withValues(alpha: 0.14)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: brandColor),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: textTheme.titleSmall?.copyWith(
                    color: inkColor,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: textTheme.bodySmall?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
