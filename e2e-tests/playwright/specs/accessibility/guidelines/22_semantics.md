### 22 Semantics

Information and relationships that are implied through visual formatting must be available to non-sighted users. Using semantic markup helps achieve this by introducing meaning into a web page rather than just presentation. For example, HTML tags like `<b>` and `<i>` are not semantic because they define only the visual appearance of text. On the other hand, tags like `<blockquote>`, `<em>`, and `<ol>` communicate the meaning of the text. Access to semantic information allows browsers and assistive technologies to present the content appropriately to users. Using semantic elements correctly ensures all users have equal access to the meaning of content.

WCAG success criteria:

- [1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
- [1.3.2: Meaningful Sequence](https://www.w3.org/WAI/WCAG21/Understanding/meaningful-sequence.html)

#### Do

Code lists with semantically correct elements. (WCAG 1.3.1)

- Unordered lists
    - Use the `<ul>` element for the container.
    - Use the `<li>` element for list items.
- Ordered lists
    - Use the `<ol>` element for the container.
    - Use the `<li>` element for list items.
- Definition lists
    - Use the `<dl>` element for the container.
    - Use the `<dt>` element for terms.
    - Use the `<dd>` element for definitions.

Contain words and phrases that are visually emphasized in semantically correct containers. (WCAG 1.3.1)

- Use the `<em>` element when you want to stress a word or phrase within the context of a sentence or paragraph.
- Use the `<strong>` element when the word or phrase is important within the context of the entire page.

#### Don't

Don't use CSS :before or :after to insert meaningful content in the page. (WCAG 1.3.1)

- Some people with visual disabilities need to modify or disable CSS styling, which might cause inserted content to move or disappear entirely.

Don't code elements in a data table as presentational. (WCAG 1.3.1)

- When `role="presentation"` is applied to a data table element, assistive technologies can't communicate to users the relationships between cells and row or column headers.

Don't use the `<blockquote>` element to indent non-quote text. (WCAG 1.3.1)

- Use CSS margin properties to create space around blocks of text.

Don't use white space characters to increase the spacing between letters of a word. (WCAG 1.3.1)

- Use the CSS letter-spacing attribute to adjust the spacing between letters.

#### 22.1 CSS content

Meaningful content must not be implemented using only CSS `:before` or `:after`.

1. In the target page, examine each highlighted item to determine whether it is meaningful or decorative.

- An element is meaningful if it conveys information that isn't available through other page content.
- An element is decorative if it could be removed from the page with no impact on meaning or function.

2. If inserted content is meaningful:

- Determine whether the information in inserted content is available to assistive technologies:
    - Open the Accessibility pane in the browser Developer Tools.
    - In the accessibility tree, examine the element with inserted content and its ancestors.
    - Verify that any information conveyed by the inserted content is shown in the accessibility tree.
- Determine whether the information in inserted content is visible when CSS is turned off:
    - Use the Web Developer browser extension (CSS > Disable All Styles) to turn off CSS.
    - Verify that any information conveyed by the inserted content is visible in the target page.

#### 22.2 Table semantics

A `<table>` element must be coded correctly as a `data` table or a `layout` table.

1. Identify and examine any data tables in the target page.

- A `data` table uses rows and columns to show relationships within a set of data.
- A `layout` table uses rows and columns to visually position content without implying any relationships.

2. Verify that each table is coded correctly for its type:

- A `data` table must not have `role="presentation"` or `role="none"` on any of its semantic elements:
    - `<table>`
    - `<tr>`
    - `<th>`
    - `<td>`
    - `<caption>`
    - `<col>`
    - `<colgroup>`
    - `<thead>`
    - `<tfoot>`
    - `<tbody>`
- The `<table>` element of a layout table must have `role="presentation"` or `role="none"`.

#### 22.3 Table headers

Coded headers must be used correctly. Coded headers include `<th>` elements and any element with a role attribute set to `"columnheader"` or `"rowheader"`.

1. Examine the target page to identify any data tables:

- A data table uses rows and columns to show relationships within a set of data.
- A layout table uses rows and columns to visually position content without implying any relationships.

2. Examine each data table to identify cells that function as headers:

- A cell functions as a header if it provides a label for one or more rows or columns of data.
- A cell does not function as a header if it serves any other purpose.

3. Verify that coded headers are used correctly:

- Cells that function as headers must be coded as headers, and
- Cells that do not function as headers must not be coded as headers.

#### 22.4 Headers attribute

The headers attribute of a `<td>` element must reference the correct `<th>` element(s).

1. If a table has `headers` attributes, inspect the page's HTML to verify that the header and data cells are coded correctly:

- Each header cell (`<th>` element) must have an id attribute.
- Each data cell (`<td>` element) must have a headers attribute.
- Each data cell's `headers` attribute must reference all cells that function as headers for that data cell.

Note: If a `headers` attribute references an element that is missing or invalid, it will fail an automated check.

#### 22.5 Lists

Lists must be contained within semantically correct containers.

1. Examine the target page to identify any content that appears to be a list. A list is a set of related items displayed consecutively. List items are usually, but not always, stacked vertically.
2. Examine the HTML for each list to verify that it is contained within the semantically correct element:

- An `unordered` list (plain or bulleted) must be contained within with a `<ul>` element.
- An `ordered` list (numbered) must be contained within an `<ol>` element.
- A `description` list (a set of terms and definitions) must be contained within a `<dl>` element.

#### 22.6 Emphasis

Words and phrases that are visually emphasized must be contained within semantically correct containers.

1. Examine the target page to identify any visually emphasized words or phrases.
2. Inspect the HTML for each emphasized word or phrase to verify that it's contained in an `<em>` or `<strong>` element.

#### 22.6 Quotes

The `<blockquote>` element must not be used to style non-quote text.

1. Search the page's HTML to determine whether the page includes any `<blockquote>` elements.
2. Examine each `<blockquote>` element to verify it contains a quote.

#### 22.6 Letter spacing

Spacing characters must not be used to increase the space between letters in a word.

1. Examine the target page to identify any words that appear to have increased spacing between letters.
2. Inspect the HTML for each word with increased spacing to verify that it does not include any spacing characters. Spacing characters include spaces, tabs, line breaks, and carriage returns.
