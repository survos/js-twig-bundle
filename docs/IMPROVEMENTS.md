# Code Improvements

This is a prioritized improvement list based on current repository state.

## High priority

- Align `JsTwigComponent` output contract with `js_twig_controller.js` input contract.
  - Controller currently expects `blocks.content`, while extraction may return keyed objects based on block names or `id` mode.
- Remove debug side effects in production paths.
  - `src/Components/JsTwigComponent.php` currently calls `dump($this)` in constructor.
- Consolidate Twig runtime extension into one place.
  - `twig_api.js` and legacy controllers both extend Twig functions (`path`, `stimulus_*`) with duplicated logic.

## Medium priority

- Split legacy vs modern API paths clearly in code organization.
  - Example: keep `lib/` as canonical API and mark `controllers/js_twig_controller.js` as compatibility layer.
- Replace Stimulus outlet coupling in Dexie flow with event-driven boundaries.
  - Current dexie controller heavily relies on `app` outlet and globals.
- Add tests around block extraction and rendering contracts.
  - PHP unit tests for `TwigBlocksTrait` extraction edge cases.
  - JS tests for compile/render error behavior and helper availability.

## Low priority

- Remove placeholder `TwigExtension` filter (`filter_name`) or implement real extension API.
- Normalize naming (`twigTemplate`, `twigTemplates`, `type`, `content`) across PHP and JS APIs.
- Add typed JSDoc/TypeScript declaration files for `twig_api` and `twig_blocks` exports.

## Suggested roadmap

1. Define one stable public contract for block payload shape.
2. Refactor `js_twig_controller.js` to use `compileTwigBlocks` + `twigRender` internally.
3. Add minimal end-to-end example fixture (Twig + Stimulus) and run it in CI.
4. Migrate Dexie controller to dispatch/listen with explicit `CustomEvent` payloads.
