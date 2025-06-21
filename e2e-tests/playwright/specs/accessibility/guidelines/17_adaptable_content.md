### 17 Adaptable Content

In general, larger fonts and ample spacing make it easier to read text, especially for people with low vision, dyslexia, or presbyopia. A 2018 study found that 1.8 billion people worldwide have presbyopia. (All people are affected by presbyopia to some degree as they age.)

People with low vision use high contrast mode to ease eye strain or to make the screen easier to read by removing extraneous information.

People with low vision and people who need cognitive assistance benefit from increased text size.

Many factors affect peoples' ability to discern between colors/shades, including screen brightness, ambient light, age, color blindness, and some types of low vision.

WCAG success criteria:

- [1.4.4: Resize text](https://www.w3.org/WAI/WCAG21/Understanding/resize-text.html)
- [1.4.12 Text Spacing](https://www.w3.org/WAI/WCAG21/Understanding/text-spacing.html)
- [1.3.4: Orientation](https://www.w3.org/WAI/WCAG21/Understanding/orientation.html)
- [1.4.10: Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow.html)
- [1.4.13 Content on Hover or Focus](https://www.w3.org/WAI/WCAG21/Understanding/content-on-hover-or-focus.html)
- [1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

#### Do

Make sure users can zoom the browser to 200% with no loss of text content or functionality. (WCAG 1.4.4)

- All text must resize fully, including text in form fields.
- Text must not be clipped, truncated, or obscured.
- All content must remain available. (Scrolling is ok.)
- All functionality must remain available.

Make sure text elements have sufficient contrast. (WCAG 1.4.3)

- Regular text must have a contrast ratio ≥ 4.5
- Large text (18pt or 14pt+bold) must have a contrast ratio ≥ 3.0.
- When using text over images, measure contrast where the text and background are most likely to have a low contrast ratio (for example, white text on a sky-blue background).

Make sure users can increase the spacing between letters, words, lines of text, and paragraphs with no clipping or overlapping. (WCAG 1.4.12)

- All text must respond to user-initiated changes in spacing.
- All text must remain visible, with no clipping or overlapping.

Make sure users can zoom the browser to 400% and still read the text without having to scroll in two dimensions. (WCAG 1.4.10)

- Ideally, text read horizontally should require only vertical scrolling, and
- Text read vertically should require only horizontal scrolling.

Make sure content that appears on focus or hover is dismissible, hoverable, and persistent. (WCAG 1.4.13)

- Dismissible. The user can make the additional content disappear without moving focus or the mouse;
- Hoverable. The additional content remains visible when the mouse moves from the trigger element onto the additional content; and
- Persistent. The additional content remains visible until (1) the user removes focus or hover from the trigger element and the additional content, (2) the user explicitly dismisses it, or (3) the information in it becomes invalid.

#### Don't

Don't disable text scaling and zooming. (WCAG 1.4.4)

- An automated check will fail if the `<meta name="viewport">` element `containsuser-scalable="no"`.

Don't lock content to any particular screen orientation (WCAG 1.3.4)

- Allow content to adjust automatically to the user's screen orientation.

#### 17.1 High contrast mode

Websites and web apps must honor high contrast appearance settings and functions.

1. Open the target page.
2. Apply a high contrast theme for your operating system.
3. Verify that the target page adopts the colors specified for the theme.

#### 17.2 Resize text

Users must be able to resize text, without using assistive technology, up to 200% with no loss of content or functionality.

1. Set your browser window width to 640 logical pixels (the equivalent of 1280 logical pixels at 200% zoom):
    - Set the maximum browser window size using these instructions.
    - Put the browser into full-screen mode.
    - Examine the target page to verify that:
        - All text resizes fully, including text in form fields.
        - Text isn't clipped, truncated, or obscured.
        - All content remains available.
        - All functionality remains available.

Exception: Images of text and captions for videos are exempt from this requirement.
Note: Check will fail if text scaling and zooming is disabled because the `user-scalable=no` parameter is used in a `<meta name="viewport">` element.

#### 17.3 Contrast

Text elements must have sufficient contrast.

1. Examine each instance in the target page to determine whether it is text.
2. Examine each text instance to identify an area where the text and background are most likely to have a low contrast ratio (e.g., white text on a light gray background).
3. Verify that each instance meets these contrast thresholds:

- Regular text must have a ratio ≥ 4.5
- Large text (18pt or 14pt+bold) must have a ratio ≥ 3.0.

#### 17.4 Orientation

Web content must not be locked to a particular screen orientation.

1. Open the target page on a device that automatically reorients web content when the device orientation changes (e.g., a mobile device).
2. Examine the target page with the device oriented vertically, then horizontally.
3. Verify that the page content reorients when the device's orientation changes.

Exception: Orientation locking is allowed if a specific orientation is essential to the underlying functionality.

#### 17.5 Reflow

Content must be visible without horizontal scrolling at 400% zoom.

1. Set the display resolution to 1280 x 1024.
2. Set the target page's zoom to 400%.
3. Verify that all text content is available without horizontal scrolling.

Exception: Horizontal scrolling is allowed for data tables, images, maps, diagrams, video, games, presentations, data tables, and interfaces where toolbars are necessary.

#### 17.6 Text spacing

Users must be able to adjust text spacing with no loss of content or functionality.

1. Adjusts the target page's text styling as follows:

- **Letter spacing (tracking)** at 0.12 times the font size
- **Word spacing** at 0.16 times the font size
- **Line height** (line spacing) at 1.5 times the font size
- **Spacing after paragraphs** at 2 times the font size

2. Verify that all of the following are true:

- All text responds to each change in styling.
- All text remains visible (no clipping).
- There is no overlapping text.

#### 17.7 Hover / focus content

Content that appears on focus or hover must be dismissible, hoverable, and persistent.

1. Examine the target page to identify any components that reveal additional content when they receive focus or pointer hover, such as a button that shows a tooltip on hover.
2. Verify that all of the following are true:

- Dismissible. A mechanism is available to dismiss the additional content without moving pointer hover or keyboard focus, unless the additional content communicates an input error or does not obscure or replace other content.
- Hoverable. If pointer hover can trigger the additional content, then the pointer can be moved over the additional content without the additional content disappearing.
- Persistent. The additional content remains visible until the hover or focus trigger is removed, the user dismisses it, or its information is no longer valid.

Exception: This requirement does not apply if the visual presentation of the additional content is controlled solely by the browser.
