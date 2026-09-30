import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/api_service.dart';
import '../../core/i18n.dart';
import '../../core/password_rules.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../models/omni_models.dart';
import '../../shared/widgets/widgets.dart';
import '../notifications/notifications_screen.dart';
import 'otp_dialog.dart';

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

  /// The server accepts an avatar up to this size (MAX_AVATAR_VALUE_LENGTH).
  static const _maxAvatarBytes = 650 * 1024;

  Future<void> _changeAvatar(Employee employee) async {
    final hasAvatar = (employee.avatarUrl ?? '').isNotEmpty;
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: Text(tx('Chụp ảnh')),
              onTap: () => Navigator.pop(context, 'camera'),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: Text(tx('Chọn từ thư viện')),
              onTap: () => Navigator.pop(context, 'gallery'),
            ),
            if (hasAvatar)
              ListTile(
                leading: Icon(Icons.delete_outline_rounded, color: dangerColor),
                title: Text(
                  tx('Xóa ảnh đại diện'),
                  style: TextStyle(color: dangerColor),
                ),
                onTap: () => Navigator.pop(context, 'remove'),
              ),
          ],
        ),
      ),
    );
    if (choice == null || !mounted) return;

    try {
      if (choice == 'remove') {
        await widget.session.updateAvatar(null);
      } else {
        // Shrunk and re-encoded on the phone: a camera photo is several MB,
        // and a 512 px JPEG looks the same in a circle this size.
        final file = await ImagePicker().pickImage(
          source: choice == 'camera' ? ImageSource.camera : ImageSource.gallery,
          maxWidth: 512,
          maxHeight: 512,
          imageQuality: 80,
          preferredCameraDevice: CameraDevice.front,
        );
        if (file == null) return;
        final bytes = await file.readAsBytes();
        if (bytes.length > _maxAvatarBytes) {
          if (mounted) {
            showAppSnack(
              context,
              tx('Ảnh quá lớn, hãy chọn ảnh khác.'),
              error: true,
            );
          }
          return;
        }
        await widget.session.updateAvatar(
          'data:${_imageType(file, bytes)};base64,${base64Encode(bytes)}',
        );
      }
      if (!mounted) return;
      showAppSnack(
        context,
        tx(
          choice == 'remove'
              ? 'Đã xóa ảnh đại diện.'
              : 'Đã cập nhật ảnh đại diện.',
        ),
      );
      await _refresh();
    } catch (error) {
      if (!mounted) return;
      showAppSnack(
        context,
        error is ApiException ? error.message : error.toString(),
        error: true,
      );
    }
  }

  /// The picture's real type, from its first bytes: the picker re-encodes to
  /// JPEG on phones but may hand back a PNG or WebP untouched elsewhere.
  static String _imageType(XFile file, List<int> bytes) {
    if (bytes.length > 3 && bytes[0] == 0x89 && bytes[1] == 0x50) {
      return 'image/png';
    }
    if (bytes.length > 11 && bytes[8] == 0x57 && bytes[9] == 0x45) {
      return 'image/webp';
    }
    if (bytes.length > 2 && bytes[0] == 0x47 && bytes[1] == 0x49) {
      return 'image/gif';
    }
    return 'image/jpeg';
  }

  Future<void> _editPersonalInfo(Employee employee) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) =>
          PersonalInfoDialog(session: widget.session, employee: employee),
    );
    if (saved == true && mounted) {
      showAppSnack(context, tx('Đã cập nhật thông tin cá nhân.'));
      await _refresh();
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
              _ProfileHeader(
                employee: widget.session.employee ?? employee,
                user: user,
                onAvatarTap: employee == null
                    ? null
                    : () => _changeAvatar(widget.session.employee ?? employee),
              ),
              const SizedBox(height: 20),
              AppPanel(
                child: Column(
                  children: [
                    ProfileRow(
                      icon: Icons.mail_outline_rounded,
                      label: tx('Email'),
                      value: employee?.personalEmail ?? user?.email,
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
                    if (employee != null) ...[
                      const SizedBox(height: 8),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: TextButton.icon(
                          onPressed: () => _editPersonalInfo(
                            widget.session.employee ?? employee,
                          ),
                          icon: const Icon(Icons.edit_outlined, size: 18),
                          label: Text(tx('Sửa thông tin cá nhân')),
                        ),
                      ),
                    ],
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
  const _ProfileHeader({
    required this.employee,
    required this.user,
    this.onAvatarTap,
  });

  final Employee? employee;
  final AuthUser? user;
  final VoidCallback? onAvatarTap;

  @override
  Widget build(BuildContext context) {
    final name = employee?.fullName ?? user?.username ?? tx('Nhân viên OmniHR');
    final subtitle = [
      employee?.employeeCode,
      employee?.department?.name,
      employee?.position?.name,
    ].where((item) => item != null && item.isNotEmpty).join(' - ');

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Row(
        children: [
          Semantics(
            button: onAvatarTap != null,
            label: tx('Đổi ảnh đại diện'),
            child: GestureDetector(
              onTap: onAvatarTap,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Hero(
                    tag: 'profile-avatar',
                    child: UserAvatar(
                      name: name,
                      avatarUrl: employee?.avatarUrl,
                      size: 64,
                    ),
                  ),
                  if (onAvatarTap != null)
                    Positioned(
                      right: -2,
                      bottom: -2,
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: brandColor,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(
                          Icons.photo_camera_rounded,
                          size: 13,
                          color: Colors.white,
                        ),
                      ),
                    ),
                ],
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

    final otpCode = await showOtpDialog(
      context,
      session: widget.session,
      purpose: 'PASSWORD_CHANGE',
    );
    if (otpCode == null || !mounted) return;

    setState(() => _submitting = true);
    try {
      await widget.session.changePassword(
        currentPassword: _currentController.text,
        newPassword: _newController.text,
        otpCode: otpCode,
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
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
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
                    errorMaxLines: 2,
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return tx('Vui lòng nhập mật khẩu mới');
                    }
                    if (!meetsPasswordRules(value)) {
                      return tx(passwordRuleHint);
                    }
                    if (value == _currentController.text) {
                      return tx('Mật khẩu mới phải khác mật khẩu hiện tại');
                    }
                    final user = widget.session.user;
                    if (passwordContainsIdentity(
                      value,
                      user?.username,
                      user?.email,
                    )) {
                      return tx(
                        'Mật khẩu không được chứa tên đăng nhập hoặc email',
                      );
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

/// The employee's own contact details: personal email and phone. Everything
/// else on the profile is kept by HR and shown read-only.
class PersonalInfoDialog extends StatefulWidget {
  const PersonalInfoDialog({
    super.key,
    required this.session,
    required this.employee,
  });

  final AppSession session;
  final Employee employee;

  @override
  State<PersonalInfoDialog> createState() => _PersonalInfoDialogState();
}

class _PersonalInfoDialogState extends State<PersonalInfoDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _emailController = TextEditingController(
    text: widget.employee.personalEmail,
  );
  late final _phoneController = TextEditingController(
    text: widget.employee.phone ?? '',
  );
  bool _submitting = false;

  static final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
  static final _phone = RegExp(r'^\+?[0-9 .-]{8,20}$');

  @override
  void dispose() {
    _emailController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final email = _emailController.text.trim().toLowerCase();
    final phone = _phoneController.text.trim();
    final emailChanged =
        email != widget.employee.personalEmail.trim().toLowerCase();
    final phoneChanged = phone != (widget.employee.phone ?? '').trim();
    if (!emailChanged && !phoneChanged) {
      Navigator.pop(context, false);
      return;
    }
    if (emailChanged && phoneChanged) {
      showAppSnack(
        context,
        tx('Hãy đổi email và số điện thoại lần lượt từng mục.'),
        error: true,
      );
      return;
    }
    final otpCode = await showOtpDialog(
      context,
      session: widget.session,
      purpose: emailChanged ? 'EMAIL_CHANGE' : 'PHONE_CHANGE',
      target: emailChanged ? email : phone,
    );
    if (otpCode == null || !mounted) return;

    setState(() => _submitting = true);
    try {
      await widget.session.updateContact(
        email: emailChanged ? email : null,
        phone: phoneChanged ? phone : null,
        otpCode: otpCode,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) {
        showAppSnack(
          context,
          error is ApiException ? error.message : error.toString(),
          error: true,
        );
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      icon: AppIconBadge(
        icon: Icons.badge_outlined,
        color: brandColor,
        size: 54,
      ),
      title: Text(tx('Sửa thông tin cá nhân')),
      content: SizedBox(
        width: 400,
        child: SingleChildScrollView(
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: tx('Số điện thoại'),
                    prefixIcon: const Icon(Icons.phone_outlined),
                  ),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isNotEmpty && !_phone.hasMatch(text)) {
                      return tx('Số điện thoại không hợp lệ');
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: InputDecoration(
                    labelText: tx('Email'),
                    helperText: tx(
                      'Cũng là email đăng nhập. Mã xác thực sẽ gửi tới email mới.',
                    ),
                    helperMaxLines: 2,
                    prefixIcon: const Icon(Icons.alternate_email_rounded),
                  ),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return tx('Vui lòng nhập email');
                    if (!_email.hasMatch(text)) {
                      return tx('Email không hợp lệ');
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 10),
                Text(
                  tx(
                    'Đổi email hoặc số điện thoại cần mã xác thực gửi qua email. Họ tên, phòng ban và chức vụ do phòng nhân sự cập nhật.',
                  ),
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: mutedTextColor),
                ),
              ],
            ),
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
