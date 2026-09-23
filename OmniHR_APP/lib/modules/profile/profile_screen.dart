import 'package:flutter/material.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';
import '../notifications/notifications_screen.dart';

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
    // Block body: an arrow would return the assigned Future to setState.
    setState(() {
      _future = _load();
    });
    try {
      await _future;
    } catch (_) {
      // The FutureBuilder already renders this failure.
    }
  }

  Future<void> _openChangePassword() async {
    final changed = await showDialog<bool>(
      context: context,
      builder: (context) => ChangePasswordDialog(session: widget.session),
    );
    if (changed == true && mounted) {
      showAppSnack(context, tx('Đã đổi mật khẩu.'));
    }
  }

  Future<void> _logout() async {
    final confirmed = await showAppConfirm(
      context,
      icon: Icons.logout_rounded,
      destructive: true,
      title: tx('Đăng xuất'),
      message: tx('Bạn muốn đăng xuất khỏi OmniHR?'),
      confirmLabel: tx('Đăng xuất'),
    );

    if (confirmed) {
      await widget.session.logout();
    }
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

        final bundle = snapshot.data!;
        final employee = bundle.employee;
        final user = widget.session.user;

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
            children: [
              _ProfileHeader(employee: employee, user: user),
              const SizedBox(height: 20),
              AppPanel(
                child: Column(
                  children: [
                    ProfileRow(
                      icon: Icons.mail_outline_rounded,
                      label: tx('Email công ty'),
                      value: employee?.companyEmail ?? user?.email,
                    ),
                    ProfileRow(
                      icon: Icons.verified_user_outlined,
                      label: tx('Trạng thái'),
                      value: employee == null
                          ? null
                          : friendlyStatus(employee.status),
                    ),
                    ProfileRow(
                      icon: Icons.event_outlined,
                      label: tx('Ngày vào làm'),
                      value: formatDate(employee?.hireDate),
                    ),
                    ProfileRow(
                      icon: Icons.phone_outlined,
                      label: tx('Số điện thoại'),
                      value: employee?.phone,
                    ),
                    Divider(
                      height: 24,
                      color: brandColor.withValues(alpha: 0.08),
                    ),
                    SectionTitle(title: tx('Tài khoản')),
                    ProfileRow(
                      icon: Icons.person_outline_rounded,
                      label: tx('Tên đăng nhập'),
                      value: user?.username,
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => SubScreen(
                            title: tx('Thông báo'),
                            child: NotificationsScreen(session: widget.session),
                          ),
                        ),
                      ),
                      icon: const Icon(Icons.notifications_outlined),
                      label: Text(tx('Thông báo')),
                    ),
                    const SizedBox(height: 10),
                    FilledButton.icon(
                      onPressed: _openChangePassword,
                      icon: const Icon(Icons.password_rounded),
                      label: Text(tx('Đổi mật khẩu')),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _logout,
                      icon: const Icon(Icons.logout_rounded),
                      label: Text(tx('Đăng xuất')),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: dangerColor,
                        side: BorderSide(
                          color: dangerColor.withValues(alpha: 0.32),
                        ),
                      ),
                    ),
                  ],
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
  const _ProfileHeader({required this.employee, required this.user});

  final Employee? employee;
  final AuthUser? user;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? tx('Nhân viên OmniHR');
    final initial = name.trim().isEmpty ? 'O' : name.trim()[0].toUpperCase();
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Hero(
            tag: 'profile-avatar',
            child: Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [brandColor, brandGreen],
                ),
              ),
              child: Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle.isEmpty ? textOf(user?.email, '-') : subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: mutedTextColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          if (employee?.status != null) ...[
            const SizedBox(width: 8),
            Pill(
              label: friendlyStatus(employee!.status),
              color: statusColor(employee!.status),
            ),
          ],
        ],
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
  final _formKey = GlobalKey<FormState>();
  final _currentController = TextEditingController();
  final _newController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _submitting = false;
  bool _obscure = true;

  @override
  void dispose() {
    _currentController.dispose();
    _newController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _submitting = true);
    try {
      await widget.session.changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
      );
      _close(true);
    } catch (error) {
      _showError(error is ApiException ? error.message : error.toString());
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
      icon: AppIconBadge(
        icon: Icons.password_rounded,
        color: brandColor,
        size: 54,
      ),
      title: Text(tx('Đổi mật khẩu')),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _currentController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: tx('Mật khẩu hiện tại'),
                  prefixIcon: const Icon(Icons.lock_outline_rounded),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return tx('Vui lòng nhập mật khẩu hiện tại');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _newController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: tx('Mật khẩu mới'),
                  prefixIcon: const Icon(Icons.password_rounded),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return tx('Vui lòng nhập mật khẩu mới');
                  }
                  if (value.length < 6) {
                    return tx('Mật khẩu mới phải có ít nhất 6 ký tự');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _confirmController,
                obscureText: _obscure,
                decoration: InputDecoration(
                  labelText: tx('Nhập lại mật khẩu mới'),
                  prefixIcon: const Icon(Icons.verified_outlined),
                  suffixIcon: IconButton(
                    tooltip: tx(_obscure ? 'Hiện mật khẩu' : 'Ẩn mật khẩu'),
                    onPressed: () => setState(() => _obscure = !_obscure),
                    icon: Icon(
                      _obscure
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return tx('Vui lòng nhập lại mật khẩu mới');
                  }
                  if (value != _newController.text) {
                    return tx('Mật khẩu nhập lại không khớp');
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actionsPadding: const EdgeInsets.fromLTRB(20, 0, 20, 18),
      actions: [
        AppDialogActions(
          children: [
            OutlinedButton(
              onPressed: _submitting
                  ? null
                  : () => Navigator.pop(context, false),
              child: Text(tx('Hủy')),
            ),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(tx(_submitting ? 'Đang lưu...' : 'Lưu')),
            ),
          ],
        ),
      ],
    );
  }
}
