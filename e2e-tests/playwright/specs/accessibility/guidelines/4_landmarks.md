### 4 Landmarks

Landmarks help users understand a web page's structure and organization. Adding ARIA landmark roles to a page's sections takes structural information that is conveyed visually and represents it programmatically. Screen readers and other assistive technologies, like browser extensions, can use this information to enable or enhance navigation.

Landmarks are not required, but if you use them, you must use them correctly. Also, if you add Landmarks, you must have a `main` Landmark.

WCAG success criteria:

- [1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)

#### Do

Contain all visible content within landmark regions. (WCAG 1.3.1)

- If you see any visible content (like text, images, or controls) outside the landmark region, that's a failure.
- An automated check will fail if the page uses landmarks and some visible content is not contained within a landmark.

Choose the landmark role that best describes the area’s content. (WCAG 1.3.1)

| Role          | HTML element           | Description                                                                                    |
| ------------- | ---------------------- | ---------------------------------------------------------------------------------------------- |
| banner        | `<header>`             | An area at the beginning of the page containing site-oriented content.                         |
| complementary | `<aside>`              | An area of the page that supports the main content, yet remains meaningful on its own.         |
| contentinfo   | `<footer>`             | An area at the end of the page containing info about the main content or website.              |
| form          | `<form>`               | An area of the page containing a collection of form-related elements.                          |
| main          | `<main>`               | The area containing the page's primary content.                                                |
| navigation    | `<nav>`                | An area of the page containing a group of links for website or page navigation.                |
| region        | `<section>`            | An area of the page containing information sufficiently important for users to navigate to it. |
| search        | `<form role="search">` | An area of the page containing search functionality.                                           |

Provide exactly one `main` landmark in every page. (WCAG 1.3.1, WCAG 2.4.1)

- An automated check will fail if the page contains more than one `main` landmark.
- Exception: If the page contains nested document or application roles, each one can have its own `banner`, `main` and `contentinfo` landmarks.

Include all of the page's primary content in the `main` landmark. (WCAG 1.3.1, WCAG 2.4.1)

If you use the same landmark role more than once in a page, give each instance a unique accessible label. (WCAG 2.4.1)

- Exception: If the page has two or more navigation landmarks that contain the same set of links, those landmarks should have the same label.
- An automated check will fail if the page contains non-unique landmarks.

Provide a descriptive label for any region landmark. (best practice)

- Regions allow you to create custom landmarks when the standard roles don't accurately describe your content.
- A `<section>` element is a landmark region only if it has a label.

Provide a visible label for any form landmarks. (best practice)

- Use `aria-labelledby` to programmatically associate the visible label with the landmark.

Use native `html` sectioning elements where possible. (best practice)

- `Search` is the only landmark that requires an ARIA role attribute. All other landmarks can be implemented using native HTML elements.

#### Don't

Don't include any repeated content in the main landmark. (WCAG 2.4.1)

- The `main` landmark should not include any blocks of content that repeat on multiple pages, such as site navigation links.

Don't use too many landmarks. (best practice)

- Five to seven landmarks in a page is ideal. More than that makes it difficult for users to efficiently navigate the page.

Don't repeat the landmark's role in its label. (best practice)

Don't use more than one `main`, `banner`, or `contentinfo` landmark.

- An automated check will fail if the page contains more than one `banner` or `contentinfo` landmark.
- An automated check will fail if a `banner`, `contentinfo`, or `main` landmark is nested within another landmark.
- Exception: If the page contains nested document or application roles, each one can have its own `banner`, `main` and `contentinfo` landmarks.

#### 4.1 Landmark roles

A landmark region must have the role that best describes its content.

1. In the target page, examine each landmark to verify that it has the `role` that best describes its content:
    1. **Banner** - Identifies site-oriented content at the beginning of each page within a website. Site-oriented content typically includes things such as the logo or identity of the site sponsor, and a site-specific search tool. A banner usually appears at the top of the page and typically spans the full width.
    2. **Complementary** - Identifies a supporting section of the document, designed to be complementary to the main content at a similar level in the DOM hierarchy, but which remains meaningful when separated from the main content.
    3. **Contentinfo** - Identifies common information at the bottom of each page within a website, typically called the "footer" of the page, including information such as copyrights and links to privacy and accessibility statements.
    4. **Form** - Identifies a set of items and objects that combine to create a form when no other named landmark is appropriate (e.g. main or search). To function as a landmark, a form must have a label.
    5. **Main** - Identifies the primary content of the page.
    6. **Navigation** - Identifies a set of links that are intended to be used for website or page content navigation.
    7. **Region** - Identifies content that is sufficiently important for users to be able to navigate to it AND no other named landmark is appropriate. To function as a landmark, a region must have a label.
    8. **Search** - Identifies a set of items and objects that combine to create search functionality.

#### 4.2 Primary content

The `main` landmark must contain all of the page's primary content.

1. Examine the target page to verify that all of the following are true:
    1. The page has exactly one `main` landmark, and
    2. The `main` landmark contains all of the page's primary content.

Exception: If a page has nested `document` or `application` roles (typically applied to `<iframe>` or `<frame>` elements), each nested document or application may **also** have one `main` landmark.

#### 4.3 No repeating content

The `main` landmark must not contain any blocks of content that repeat across pages.

1. Examine the target page to verify that all of the following are true:
    1. The page has exactly one `main` landmark, and
    2. The `main` landmark does not contain any blocks of content that repeat across pages (such as site-wide navigation links).

Exception: If a page has nested `document` or `application` roles (typically applied to `<iframe>` or `<frame>` elements), each nested document or application may **also** have one `main` landmark.
