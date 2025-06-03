### 21 Sequence

By default, browsers and assistive technologies present content to users in DOM order (the order that it appears in the HTML). When coding is added to modify the apparent order of content, assistive technologies might not be able to programmatically determine the intended reading order of content. As a result, people who use assistive technologies might encounter content in an order that doesn't make sense.

WCAG success criteria:

- [1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
- [1.3.2: Meaningful Sequence](https://www.w3.org/WAI/WCAG21/Understanding/meaningful-sequence.html)

#### Do

When using CSS to position meaningful content, ensure it still makes sense when CSS is disabled. (WCAG 1.3.1)

- If you use `position:absolute`, be sure the DOM order matches the expected reading order.
- Avoid using `float:right`, as it always creates a mismatch: elements displayed on the right of the screen appear in the DOM before those on the left.

When using layout tables to position content, ensure it still makes sense when the table is linearized. (WCAG 1.3.1)

- Because assistive technologies read tables in DOM order, tables are presented row-by-row, not column-by-column.

#### Don't

Don't use white space characters to create the appearance of columns.

- Instead, use a layout table or CSS to display the content in columns.

#### 21.1 CSS positioning

Meaningful content positioned on the page using CSS must retain its meaning when CSS is disabled.

1. Examine the target page to determine whether it has any content positioned using CSS that's meaningful:
    1. Content is **meaningful** if it conveys information that isn't available through other page content.
    2. Content is **decorative** if it could be removed from the page with no impact on meaning or function.
2. If the page does have meaningful positioned content, disable CSS to show the page in DOM order.
3. Verify that the positioned content retains its meaning when the page is linearized.

#### 21.2 Layout tables

The content in an HTML layout table must make sense when the table is linearized.

1. Identify any `<table>` elements in the target page.
2. If you find a table, determine whether it is a **layout** table:
    1. A **data** table uses rows and columns to show relationships within a set of data.
    2. A **layout** table uses rows and columns to visually position content without implying any relationships.
3. If you find a layout table, disable CSS to show the page in DOM order.
4. Verify that content in layout tables still has the correct reading order when the page is linearized.

#### 21.3 Columns

Content presented in multi-column format must support a correct reading sequence.

1. Examine the page to identify any side-by-side columns of text or data that are **not** contained in a table cell.
2. Using your mouse or keyboard, verify that you can select **all** of the text in one column without selecting **any** text from an adjacent column.
