### 5 Headings

The function of a heading is to label a section of content. Headings should not be used as a convenient way to style other text.

Assistive technologies use markup tags to help users navigate pages and find content more quickly. Screen readers recognize coded headings, and can announce the heading along with its level, or provide another audible cue like a beep. Other assistive technologies can change the visual display of a page, using properly coded headings to display an outline or alternate view.

WCAG success criteria:

- [1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
- [2.4.6: Headings and Labels](https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels.html)

#### Do

Provide a way for keyboard users to bypass blocks of repeated content. (WCAG 2.4.1)

- If you use headings to meet this requirement, you must use them correctly.

Use headings to label sections of page content. (best practice)

- Headings are especially helpful on pages with a lot of text content.

Write a heading that accurately describes the block of content that follows it. (WCAG 2.4.6)

- If a heading doesn't provide an accurate label for the following content, that's a failure.

Align programmatic hierarchy and visual hierarchy. (WCAG 1.3.1)

- Programmatic heading levels should match their visual appearance (like size and boldness).

Use exactly one top-level heading. (best practice)

- Top-level (`h1`) headings should give an overall description of the page content.
- Top-level (`h1`) headings can be similar, or even identical, to the page title.

Structure multiple headings on a page hierarchically. (best practice)

- For example, try to follow nested content under an `h2` heading with `h3` before you use `h4`.
- Exception: For fixed content that repeats across pages (like a footer or a sidebar), the heading level should not change.
- In that case, consistency across pages is more important.

Use native HTML heading elements. (best practice)

- Exception: It's OK to add `role="heading"` to another element if it's necessary for an accessibility retrofit.
- The Headings visualization indicates which method is used for each heading:
    - An uppercase `H` indicate headings made using heading tags.
    - A lowercase `h` indicates headings made using role="heading".
    - A lowercase `h` followed by a dash (`h-`) indicates that the element does not have an `aria-level` attribute.

#### Don't

Don't use headings to style text that doesn't function as a heading. (WCAG 1.3.1)

- Use styles instead, like font size, bolding, or italics.

Don't use styling alone to make text look like a heading. (WCAG 1.3.1, WCAG 2.4.1)

- Assistive technology depends on explicit markup. It does not interpret visual styling to identify structural elements.

Don't use `display:none`, `visibility:hidden` or `aria-hidden` to make headings invisible only to sighted users. (a11y tech tip)

- Those properties make headings unavailable to everyone, including assistive technology users. Use this CSS instead: `className="element-invisible"`

#### 5.1 Heading function

An element **coded** as a heading must **function** as a heading.

1. In the target page, examine each coded heading element (`h1` through `h6` tags and elements with `role="heading"`) to verify that it **functions** as a heading:
    1. An element functions as a heading if it serves as a descriptive label for the section of content that follows it.
    2. An element does not function as a heading if it serves any other purpose.

#### 5.2 Heading level

A heading's **programmatic** level must match the level that's presented **visually**.

1. In the target page, examine each heading to verify that its **programmatic** level matches the level that's presented **visually** (through font style).
    1. Lower-level headings should be more prominent than higher-level headings. (Level 1 should be the most prominent, level 6 the least.)
    2. Headings of the same level should have the same font style.

#### 5.3 No missing headings

Text that **looks like** a heading must be **coded** as a heading.

1. Examine the target page to verify that each element that **looks like a** heading is **coded** as a heading using:
    - HTML heading tags (`h1` through `h6`)
    - Elements with `role="heading"`
