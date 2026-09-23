import 'package:flutter/widgets.dart';

/// Ties text controllers to the lifetime of the subtree that uses them.
///
/// A modal route's future completes when the pop *starts*, so disposing a
/// controller right after `await showModalBottomSheet(...)` kills it while the
/// sheet's fields are still mounted and animating out. Their `dispose` then
/// throws on the dead controller, the unmount walk aborts half way, and the
/// frame dies on `'_dependents.isEmpty': is not true`. Wrapping the sheet body
/// in this widget moves the disposal to where it belongs: the element that
/// actually stops using the controllers.
class ControllerScope extends StatefulWidget {
  const ControllerScope({
    super.key,
    required this.controllers,
    required this.child,
  });

  final List<TextEditingController> controllers;
  final Widget child;

  @override
  State<ControllerScope> createState() => _ControllerScopeState();
}

class _ControllerScopeState extends State<ControllerScope> {
  @override
  void dispose() {
    for (final controller in widget.controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
