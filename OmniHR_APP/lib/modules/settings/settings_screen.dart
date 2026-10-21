import 'package:flutter/material.dart';

import '../../core/i18n.dart';
import '../../core/session.dart';
import '../../core/utils.dart';
import '../../shared/widgets/widgets.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key, required this.session});

  final AppSession session;

  @override
  Widget build(BuildContext context) {
    // This screen is the one that changes the theme and the language, and it
    // sits in a pushed route, which is built once and then kept. Without
    // listening to the session the switch would stay where it was, the
    // labels would keep the old language and the panel would keep the old
    // palette until the user left the screen and came back.
    return AnimatedBuilder(
      animation: session,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 112),
        children: [_panel(context)],
      ),
    );
  }

  Widget _panel(BuildContext context) {
    final dark = session.themeMode == ThemeMode.dark;

    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionTitle(title: tx('Cài đặt hiển thị')),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: dark,
            onChanged: (value) =>
                session.setThemeMode(value ? ThemeMode.dark : ThemeMode.light),
            // The label names the mode the app is in right now, so the row
            // still reads correctly once the switch is on.
            title: Text(dark ? tx('Giao diện tối') : tx('Giao diện sáng')),
            secondary: Icon(
              dark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
              color: brandColor,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(Icons.translate_rounded, color: brandColor),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  tx('Ngôn ngữ'),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              SegmentedButton<AppLanguage>(
                showSelectedIcon: false,
                segments: [
                  ButtonSegment(
                    value: AppLanguage.vi,
                    label: Text(tx('Tiếng Việt')),
                  ),
                  ButtonSegment(
                    value: AppLanguage.en,
                    label: Text(tx('English')),
                  ),
                ],
                selected: {session.language},
                onSelectionChanged: (value) => session.setLanguage(value.first),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
