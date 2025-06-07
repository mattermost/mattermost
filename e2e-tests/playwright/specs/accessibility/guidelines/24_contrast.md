### 24 Contrast

Contrast ratio describes the relative brightness of foreground and background colors on a computer display. In general, higher contrast ratios make text and graphics easier to perceive and read. Black and white have the highest possible contrast ratio, 21:1. Identical colors have the lowest possible contrast ratio, 1:1. All other color combinations fall somewhere in between.

WCAG success criteria:

- [1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)

#### Do

Provide sufficient contrast for visual information that helps users detect and operate active controls. (WCAG 1.4.11)

- Any visual boundary that indicates the component's clickable area must have a contrast ratio ≥ 3:1.
- Any visual effect that indicates the component's state must have a contrast ratio ≥ 3:1.
  Provide sufficient contrast for graphics. (WCAG 1.4.11)
- Elements in a graphic that communicate meaning must have a contrast ratio ≥ 3:1.

#### Don't

Don't style controls in a way that interferes with their visual focus indicator. (WCAG 1.4.11)

- Don't use CSS styling to turn off the default focus indicator.
- Don't style a control's borders in a way looks like a focus indicator.
- Don't style a control's borders in a way that occludes the focus indicator.

#### 24.1 UI components

Visual information used to identify active user interface components and their states must have sufficient contrast.

1. In the target page, examine each interactive component in its normal state (not disabled or selected, no mouseover or input focus).
2. Use a contrast checker to verify that the following visual information (if present) has a contrast ratio of at least 3:1 against the adjacent background:
    1. Any visual information that's needed to identify the component
        1. Visual information is almost always needed to identify text inputs, checkboxes, and radio buttons.
        2. Visual information might not be needed to identify other components if they are identified by their position, text style, or context.
    2. Any visual information that indicates the component is in its normal state

Exception: No minimum contrast ratio is required if either of the following is true:

1. The component is inactive/disabled.
2. The component's appearance is determined solely by the browser.

#### 24.2 State changes

Any visual information that indicates a component's state must have sufficient contrast.

1. In the target page, examine each highlighted element to determine whether it supports any of the following states:

- Focused
- Hover (mouseover)
- Selected

2. In each supported state (including combinations), use Accessibility Insights for Windows (or the Colour Contrast Analyser if you are testing on a Mac) to verify that the following visual information, if present, has a contrast ratio of at least 3:1 against the adjacent background:

- Any visual information that's needed to identify the component
    - Visual information is almost always needed to identify text inputs, checkboxes, and radio buttons.
    - Visual information might not be needed to identify other components if they are identified by their position, text style, or context.
- Any visual information that indicates the component's current state
  Exceptions:
    - No minimum contrast ratio is required if either of the following is true:
        - The component is inactive/disabled.
        - The component's appearance is determined solely by the browser.
    - If a component has redundant state indicators (such as unique background color and unique text style), only one indicator is required to have sufficient contrast.
    - Hover indicators do not need to have sufficient contrast against the background, but their presence must not cause other state indicators to lose sufficient contrast.
