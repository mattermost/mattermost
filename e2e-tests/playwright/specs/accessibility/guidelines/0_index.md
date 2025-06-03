# Accessibility Testing Guidelines

This directory contains comprehensive accessibility testing guidelines, based on [Accessibility Insights](https://accessibilityinsights.io/docs/web/overview/) and [WCAG 2.1 standards](https://www.w3.org/WAI/WCAG22/quickref/?versions=2.1).

## Testing Categories

### 1. [Automated Checks](./1_automated_checks.md)

Foundation for automated accessibility testing using tools like axe-core. Can detect common accessibility problems but most issues require manual testing.

### 2. [Keyboard](./2_keyboard.md)

Ensures users can navigate to every interactive component using only the keyboard. Tests keyboard accessibility, navigation order, focus management, and prevents keyboard traps. Critical for users who cannot use a mouse due to vision or mobility limitations.

### 3. [Focus](./3_focus.md)

Validates that interactive elements provide visible focus indicators and that focus moves logically through the interface. Tests focus visibility, modal dialog behavior, and proper focus management when content is revealed or hidden.

### 4. [Landmarks](./4_landmarks.md)

Tests ARIA landmark roles that help users understand page structure and organization. Validates proper use of banner, main, navigation, complementary, and other landmark regions to enable enhanced navigation for screen reader users.

### 5. [Headings](./5_headings.md)

Ensures headings are used to label content sections and follow proper hierarchical structure. Tests that headings accurately describe content, maintain programmatic hierarchy, and provide navigation aids for assistive technology users.

### 6. [Repetitive Content](./6_repetitive_content.md)

Validates skip links and bypass mechanisms that allow keyboard users to navigate directly to main content. Tests consistent navigation ordering and identification of functional components across pages.

### 7. [Links](./7_links.md)

Tests that links have clear purposes and appropriate ARIA roles. Validates link text describes destinations, anchor elements function correctly, and link purposes are understandable from context or accessible names.

### 8. [Native Widgets](./8_native_widgets.md)

Tests native HTML form controls (buttons, inputs, selects, textareas) for proper labeling, instructions, and state communication. Validates programmatic relationships between labels and controls, and appropriate autocomplete attributes.

### 9. [Custom Widgets](./9_custom_widgets.md)

Validates custom interactive components follow ARIA design patterns. Tests proper roles, states, properties, keyboard interaction, and programmatic communication of widget purpose and current state.

### 10. [Timed Events](./10_timed_events.md)

Tests time limits, auto-updating content, and automatically playing media. Validates that users can control, adjust, or extend time limits, and can pause, stop, or hide moving content and auto-playing audio.

### 11. [Errors](./11_errors.md)

Tests error identification, correction suggestions, and prevention mechanisms. Validates that input errors are clearly described in text, guidance is provided for corrections, and users can review submissions before finalizing.

### 12. [Page](./12_page.md)

Tests page-level requirements including titles, frame labels, navigation methods, and language identification. Validates descriptive page titles, proper frame labeling, multiple navigation paths, and correct language attributes.

### 13. [Parsing](./13_parsing.md)

Validates HTML markup integrity to ensure assistive technologies can accurately parse content. Tests for complete start/end tags, unique attributes, and proper element nesting according to specifications.

### 14. [Images](./14_images.md)

Tests image accessibility including alt text, decorative vs. meaningful image identification, and images of text. Validates that meaningful images have appropriate text alternatives and CAPTCHAs provide multiple format options.

### 15. [Language](./15_language.md)

Tests language identification for pages and content sections. Validates proper lang attributes on HTML elements and text direction attributes for right-to-left scripts, enabling correct screen reader pronunciation.

### 16. [Sensory](./16_sensory.md)

Tests that information isn't conveyed through sensory characteristics alone. Validates color isn't the only means of communication, instructions don't rely solely on sensory characteristics, and auditory cues have visual alternatives.

### 17. [Adaptable Content](./17_adaptable_content.md)

Tests content adaptability including text resizing, spacing adjustments, orientation flexibility, and contrast requirements. Validates content works at 200% zoom, supports custom text spacing, and maintains functionality across orientations.

### 18. [Audio/Video](./18_audio_video.md)

Tests accessibility of single-media content. Validates that audio-only content has text transcripts and video-only content has text or audio alternatives that convey equivalent information.

### 19. [Multimedia](./19_multimedia.md)

Tests synchronized audio/video content accessibility. Validates captions for prerecorded multimedia, audio descriptions for visual content, proper synchronization, and content that doesn't obstruct important information.

### 20. [Live Multimedia](./20_live_multimedia.md)

Tests real-time multimedia accessibility. Validates that live streaming video with audio provides real-time captions including speech, speaker identification, and meaningful sound effects.

### 21. [Sequence](./21_sequence.md)

Tests content reading order and sequence. Validates that CSS positioning doesn't disrupt meaningful content order, layout tables linearize properly, and multi-column content supports correct reading sequences.

### 22. [Semantics](./22_semantics.md)

Tests semantic markup usage including proper list structures, emphasis elements, and table coding. Validates correct use of HTML semantic elements rather than presentational markup, and proper table header relationships.

### 23. [Pointer Motion](./23_pointer_motion.md)

Tests pointer and motion accessibility including gesture alternatives, pointer cancellation, and motion actuation. Validates single-pointer alternatives to complex gestures, cancellation mechanisms, and UI alternatives to motion-based functions.

### 24. [Contrast](./24_contrast.md)

Tests visual contrast for UI components and graphics. Validates sufficient contrast ratios (≥3:1) for visual information that identifies components, indicates states, and communicates meaning in graphics and interactive elements.

### 25. [Cognitive](./25_cognitive.md)

Tests cognitive accessibility including authentication methods and data entry requirements. Validates that users don't need to memorize information, can copy/paste passwords, and aren't required to re-enter previously provided information.

## Usage in Playwright Tests

These guidelines provide the foundation for:

- **Automated accessibility checks** using tools like axe-core
- **Manual testing procedures** for complex accessibility requirements
- **Test case design** that covers comprehensive accessibility scenarios
- **Accessibility validation** in CI/CD pipelines
- **Developer education** on accessibility best practices

## WCAG Compliance

All guidelines are based on Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards, ensuring comprehensive coverage of accessibility requirements for web applications.

## Testing Tools Integration

These guidelines are designed to work with:

- Playwright's built-in accessibility testing capabilities
- axe-core integration for automated checks
- Manual testing procedures using browser developer tools
- Screen reader testing methodologies
- Keyboard navigation testing approaches

For implementation details and test examples, see the individual guideline files.
