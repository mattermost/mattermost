### 7 Links

A link is a specific type of widget (interactive interface component) that navigates the user to new content, either in the current page or in a new page. A link is typically implemented as an HTML `<a>` (anchor) element with an `href` value.

However, `<a>` elements are frequently scripted to function as buttons. The difference between a link and a button:

- A **link** _navigates_ to new content.
- A **button** _activates_ functionality (e.g., shows or hides content, toggles a state on or off).

An `<a>` element that functions as a button or other custom widget must have the appropriate widget role.

WCAG success criteria:

- [4.1.2: Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html)
- [2.4.4: Link Purpose (In Context)](https://www.w3.org/WAI/WCAG21/Understanding/link-purpose-in-context.html)
- [2.5.3: Label in Name](https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html)

#### Do

If an anchor element functions as a button, give it the appropriate ARIA widget role. (WCAG 4.1.2)

- Add `role="button"` to the anchor element.
- Better: Use a `<button>` element instead of an `<a>` element. (As a rule, it's better to use native semantics than to modify them using ARIA roles.)

Describe the purpose of each link. (WCAG 2.4.4)

- Use any of the following:
    - **Good:** Programmatically related context
    - **Better:** Accessible name and/or accessible description
    - **Best:** Link text

Programmatically related context includes:

- Text in the same sentence, paragraph, list item, or table cell as the link
- Text in a parent list item
- Text in a table header cell associated with the cell that contains the link

Writing tips:

- If a link's destination is a document or web application, the name of the document or application is sufficient.
- Links with different destinations should have different descriptions; links with the same destination should have the same description.
- Programmatically related context is easier to understand when it precedes the link.

#### 7.1 Link function

If an anchor element functions as a custom widget, it must have the appropriate ARIA widget role.

1. In the target page, examine each anchor element that is a possible custom widget to verify that it functions as a link (i.e., it navigates to new content in the current page or in a new page).

Note: Anchor elements that are possible custom widgets are those that don't have an ARIA widget role, but they do have some custom widget markup, such as `tabindex="-1"`, an ARIA attribute, a non-widget role, or no `href`.

#### 7.2 Link purpose

The purpose of a link must be described by its link text alone, or by the link text together with preceding page context.

1. Examine each link to verify that its accessible name describes its purpose.
   a. If a link navigates to a document or web page, the name of the document or page is sufficient.
   b. Links with different destinations should have different link text.
   c. Links with the same destination should have the same link text.

2. If a link's purpose is clear from its accessible name, mark it as Pass.

3. If a link's purpose is not clear from its accessible name, examine the link in the context of the target page to verify that its purpose is described by the link together with its preceding page context, which includes:
   a. Text in the same sentence, paragraph, list item, or table cell as the link
   b. Text in a parent list item
   c. Text in the table header cell that's associated with cell that contains the link

#### 7.3 Label in name

A link's accessible name must contain its visible text label.

1. In the target page, examine each link to identify its visible text label.

2. Compare each link's visible text label to its accessible name.

3. Verify that:
   a. The accessible name is an exact match of the visible text label, or
   b. The accessible name contains an exact match of the visible text label, or
   c. The link does not have a visible text label.
