### 12 Page

This test addresses a variety of page-level requirements that ensure users can find the pages they want.

WCAG success criteria:

- [2.4.2: Page Titled](https://www.w3.org/WAI/WCAG21/Understanding/page-titled.html)
- [4.1.2: Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html)
- [2.4.5: Multiple Ways](https://www.w3.org/WAI/WCAG21/Understanding/multiple-ways.html)
- [3.1.1: Language of Page](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html)

#### Do

Give every page a title that describes its topic or purpose. (WCAG 2.4.2)

Give every frame or iframe an accessible name that describes its content.(WCAG 4.1.2)

Provide two or more methods for users to find and navigate to pages in a website. (WCAG 2.4.5)

- Ideally, make site search one of the methods.

#### 12.1 Page title

A web page must have a title that describes its topic or purpose.

1. Consider the title of the target page.
2. Verify that the page's title describes its topic or purpose:
    1. For pages within a website, the page title must be unique.
    2. For documents or single-page web apps, the document name or app name is sufficient.

#### 12.2 Frame title

A frame or iframe must have a title that describes its content.

1. Examine each `<frame>` or `<iframe>` in the target page to verify that its title describes its content.

#### 12.3 Multiple ways

Users must have multiple ways to navigate to a page.

1. Examine the target page to determine whether:
    1. The page is part of a multi-page website or web app.
        1. If there are no other pages within the site or app, this requirement passes.
    2. The page is the result of, or a step in, a process.
        1. If the page is part of a process, this requirement passes.
2. Verify that the page provides two or more ways to locate pages within the site or app, such as:
    1. Site maps
    2. Site search
    3. Tables of contents
    4. Navigation menus or dropdowns
    5. Navigation trees
    6. Links between pages

#### 12.4 Language of page

A page must have the correct default language.

1. Examine the target page to determine its primary language.
2. Inspect the page's `<html>` tag to verify that it has the correct language attribute.
