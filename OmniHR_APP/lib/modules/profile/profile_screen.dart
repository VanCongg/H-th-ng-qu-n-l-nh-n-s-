import 'package:flutter/material.dart';

import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/common.dart';

class ProfileBundle {
  ProfileBundle({required this.employee});

  final Employee? employee;
}

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, required this.session});

  final AppSession session;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late Future<ProfileBundle> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ProfileBundle> _load() async {
    Employee? employee = widget.session.employee;
    try {
      employee = await widget.session.loadEmployeeProfile(silent: true);
    } catch (_) {
      employee = widget.session.employee;
    }
    return ProfileBundle(employee: employee);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  void _showSnack(String message, {bool error = false}) {
    if (!mounted) return;
    showAppSnack(context, message, error: error);
  }

  Future<void> _openChangePassword() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (context) => ChangePasswordDialog(session: widget.session),
    );
    if (changed == true) _showSnack('Đã đổi mật khẩu.');
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          icon: const AppIconBadge(
            icon: Icons.logout_rounded,
            color: dangerColor,
            size: 54,
          ),
          title: const Text('Đăng xuất'),
          content: const Text('Bạn muốn đăng xuất khỏi OmniHR?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Hủy'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: dangerColor),
              child: const Text('Đăng xuất'),
            ),
          ],
        );
      },
    );

    if (confirmed == true) {
      await widget.session.logout();
    }
  }

  void _openProfileDetails(Employee? employee) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
            child: AppPanel(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ProfileRow(
                    icon: Icons.mail_outline_rounded,
                    label: 'Email công ty',
                    value: employee?.companyEmail ?? widget.session.user?.email,
                  ),
                  ProfileRow(
                    icon: Icons.phone_outlined,
                    label: 'Số điện thoại',
                    value: employee?.phone,
                  ),
                  ProfileRow(
                    icon: Icons.business_outlined,
                    label: 'Phòng ban',
                    value: employee?.department?.name,
                  ),
                  ProfileRow(
                    icon: Icons.badge_outlined,
                    label: 'Chức danh',
                    value: employee?.position?.name,
                  ),
                  ProfileRow(
                    icon: Icons.event_outlined,
                    label: 'Ngày vào làm',
                    value: formatDate(employee?.hireDate),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _openPolicies() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: const [
                _ProfileMenuItem(
                  icon: Icons.article_outlined,
                  title: 'Nội quy công ty',
                  subtitle: 'Đang chờ kết nối dữ liệu chính sách',
                ),
                _ProfileMenuItem(
                  icon: Icons.health_and_safety_outlined,
                  title: 'Phúc lợi',
                  subtitle: 'Đang chờ kết nối dữ liệu chính sách',
                ),
                _ProfileMenuItem(
                  icon: Icons.beach_access_outlined,
                  title: 'Quy định nghỉ phép',
                  subtitle: 'Đang chờ kết nối dữ liệu chính sách',
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _openSettings() {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 4, 18, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _ProfileMenuItem(
                  icon: Icons.password_rounded,
                  title: 'Đổi mật khẩu',
                  subtitle: 'Cập nhật mật khẩu đăng nhập',
                  onTap: () {
                    Navigator.pop(context);
                    _openChangePassword();
                  },
                ),
                _ProfileMenuItem(
                  icon: Icons.dns_outlined,
                  title: 'API server',
                  subtitle: widget.session.baseUrl,
                ),
                _ProfileMenuItem(
                  icon: Icons.logout_rounded,
                  title: 'Đăng xuất',
                  subtitle: 'Thoát khỏi tài khoản hiện tại',
                  color: dangerColor,
                  onTap: () {
                    Navigator.pop(context);
                    _logout();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ProfileBundle>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const LoadingView();
        }
        if (snapshot.hasError) {
          return ErrorView(error: snapshot.error.toString(), onRetry: _refresh);
        }

        final employee = snapshot.data!.employee;
        final name =
            employee?.fullName ??
            widget.session.user?.username ??
            'OmniHR user';
        final roleLine = [
          employee?.employeeCode,
          employee?.department?.name,
          employee?.position?.name,
        ].where((item) => item != null && item.isNotEmpty).join(' - ');

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 112),
            children: [
              Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 480),
                  child: Column(
                    children: [
                      _ProfileHeader(name: name, subtitle: roleLine),
                      const SizedBox(height: 18),
                      _ProfileMenuItem(
                        icon: Icons.person_outline_rounded,
                        title: 'Hồ sơ',
                        subtitle: 'Thông tin cá nhân và công việc',
                        onTap: () => _openProfileDetails(employee),
                      ),
                      _ProfileMenuItem(
                        icon: Icons.policy_outlined,
                        title: 'Chính sách',
                        subtitle: 'Nội quy, phúc lợi và quy định nghỉ phép',
                        onTap: _openPolicies,
                      ),
                      _ProfileMenuItem(
                        icon: Icons.settings_outlined,
                        title: 'Cài đặt',
                        subtitle: 'Mật khẩu, máy chủ và đăng xuất',
                        onTap: _openSettings,
                      ),
                    ],
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

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.name, required this.subtitle});

  final String name;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final initial = name.trim().isEmpty ? 'O' : name.trim()[0].toUpperCase();

    return AppPanel(
      padding: const EdgeInsets.fromLTRB(18, 24, 18, 22),
      child: Column(
        children: [
          Container(
            width: 96,
            height: 96,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [brandColor, brandGreen],
              ),
              border: Border.all(color: Colors.white, width: 4),
              boxShadow: [
                BoxShadow(
                  color: brandColor.withValues(alpha: 0.24),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Text(
              initial,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 38,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            name,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: 5),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: mutedTextColor,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProfileMenuItem extends StatelessWidget {
  const _ProfileMenuItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.color = brandColor,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Row(
          children: [
            AppIconBadge(icon: icon, color: color, size: 44),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: mutedTextColor,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            if (onTap != null) ...[
              const SizedBox(width: 10),
              const Icon(Icons.chevron_right_rounded, color: mutedTextColor),
            ],
          ],
        ),
      ),
    );
  }
}

class ChangePasswordDialog extends StatefulWidget {
  const ChangePasswordDialog({super.key, required this.session});

  final AppSession session;

  @override
  State<ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<ChangePasswordDialog> {
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_newController.text.length < 6) {
      showAppSnack(
        context,
        'Mật khẩu mới phải có ít nhất 6 ký tự.',
        error: true,
      );
      return;
    }
    if (_newController.text != _confirmController.text) {
      showAppSnack(context, 'Xác nhận mật khẩu không khớp.', error: true);
      return;
    }

    setState(() => _submitting = true);
    try {
      await widget.session.api.post(
        '/auth/change-password',
        body: {
          'currentPassword': _currentController.text,
          'newPassword': _newController.text,
        },
      );
      _close(true);
    } catch (error) {
      _showError(error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _close(bool value) {
    if (!mounted) return;
    Navigator.pop(context, value);
  }

  void _showError(String message) {
    if (!mounted) return;
    showAppSnack(context, message, error: true);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: const AppIconBadge(
        icon: Icons.password_rounded,
        color: brandColor,
        size: 54,
      ),
      title: const Text('Đổi mật khẩu'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _currentController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mật khẩu hiện tại'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _newController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Mật khẩu mới'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _confirmController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Xác nhận mật khẩu'),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.pop(context, false),
          child: const Text('Hủy'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: Text(_submitting ? 'Đang lưu...' : 'Lưu'),
        ),
      ],
    );
  }
}
