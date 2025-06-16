### 6 Repetitive Content

When interacting with a website or web app, keyboard users need a way to skip repetitive content and navigate directly to the page's primary content. Content that appears repeatedly within a website or web app must be ordered and identified consistently to allow users to locate specific information efficiently.

WCAG success criteria:

- [2.4.1: Bypass Blocks](https://www.w3.org/WAI/WCAG21/Understanding/bypass-blocks.html)
- [3.2.3: Consistent Navigation](https://www.w3.org/WAI/WCAG21/Understanding/consistent-navigation.html)
- [3.2.4: Consistent Identification](https://www.w3.org/WAI/WCAG21/Understanding/consistent-identification.html)
- [3.2.6: Consistent Help](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)

#### Do

Provide at least one method for keyboard users to navigate directly to the page's main content. (WCAG 2.4.1)

- Acceptable methods include skip links, landmarks, and headings.
- Skip links are a best practice, as they're available to all keyboard users, even if they don't use any assistive technology.

Make sure navigational links that appear on multiple pages are ordered consistently. (WCAG 3.2.3)

- It's ok if non-repeated (page-specific) links are inserted between repeated (site-wide) links.

Make sure functional components that appear on multiple pages are identified consistently. (WCAG 3.2.4)

- Every time the same specific functional component appears, use the same label, icon, and/or text alternative.

#### 6.1 Bypass blocks

A page must provide a keyboard-accessible method to bypass repetitive content.

1. Examine the target page to identify:
    1. The starting point of the page's primary content.
    2. Any blocks of content that (1) **precede** the primary content and (2) appear on multiple pages, such as banners, navigation links, and advertising frames.
2. Refresh the page to ensure that it's in its default state.
3. Use the **Tab** key to navigate toward the primary content. As you navigate, look for a bypass mechanism (typically a skip link). The mechanism might not become visible until it receives focus.
4. If a bypass mechanism **does not** exist, record this as a failure.
5. If a bypass mechanism **does** exist, activate it.
6. Verify that focus shifts past any repetitive content to the page's primary content.

#### 6.2 Consistent navigation

Navigational mechanisms that appear on multiple pages must be presented in the same relative order.

1. Examine the target page to identify any navigational mechanisms (such as site navigation bars, search fields, and skip links) that appear on multiple pages.
2. Verify that the links or buttons in each navigational mechanism are presented in the same relative order each time they appear. (Items should be in the same relative order even if other items are inserted or removed between them.)

#### 6.3 Consistent identification

Functional components that appear on multiple pages must be identified consistently.

1. Examine the target page to identify any functional components (such as links, widgets, icons, images, headings, etc.) that appear on multiple pages.
2. Use the Accessibility pane in the browser Developer Tools to verify that the component has the same accessible name each time it appears.

#### 6.4 Consistent help

Ensure help – or mechanism(s) to request help – are consistently located in the same relative location across a set of web pages/screens.

Note: this criterion does not require help to be provided.

1. Examine the target page to identify "help" mechanisms (for example links to help, etc.) on the page. Determine if this is a set of web pages with blocks of content that are repeated on multiple pages.
2. Verify that all helpful information and mechanisms provided are consistent with other pages in terms of location, behavior and relative to the other content of the page & UI for all components where help resides.

Exception: The location of a help mechanism can change based on user input, for example resizing of the window that changes the location of the help link – this would still pass this rule so long as the help link was consistently presented in the same location across the same set of web pages at the adjusted window size.
