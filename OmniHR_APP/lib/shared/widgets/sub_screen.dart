import 'package:flutter/material.dart';

import '../../core/utils.dart';
import 'brand_backdrop.dart';

class SubScreen extends StatelessWidget {
  const SubScreen({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: appBackgroundColor,
      appBar: AppBar(
        title: Text(title),
        backgroundColor: surfaceColor.withValues(alpha: 0.92),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
      ),
      body: BrandBackdrop(child: child),
    );
  }
}
