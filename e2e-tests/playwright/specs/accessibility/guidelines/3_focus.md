### 3 Focus

When interacting with a website or web app using a keyboard, users need to know which component currently has the input focus. By default, web browsers indicate focus visually, but custom programming, styles, style sheets, and scripting can disrupt it.

When navigating sequentially through a user interface, keyboard users need to encounter information in an order that preserves its meaning and allows them to perform all supported functions. By default, focus order follows the DOM order, but tabindex attributes and scripting can be added to modify the focus order.

WCAG success criteria:

- [2.4.7: Focus Visible](https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html)

#### Do

Provide a visible focus indicator on the interactive element that has the input focus. (WCAG 2.4.7)

- Input focus is commonly indicated by a solid or dotted border surrounding the element, but other visible changes are acceptable.

Ensure interactive components receive focus in a logical, usable order. (WCAG 2.4.3)

- Typically, keyboard users should encounter interactive components in the same order you would expect for mouse users.

When previously hidden content is revealed, move focus into the revealed content. (WCAG 2.4.3)

- For example, opening a menu should move focus to the first focusable menu option.
- Opening a dialog should move focus to a component in the dialog.

Handle focus correctly when revealed content is again hidden. (WCAG 2.4.3)

- In most cases, the best option is to move focus back to the original trigger component.

#### Don't

Don’t assume focus order must strictly follow a left-to-right / top-to-bottom reading order. (WCAG 2.4.3)

- For example, if you expect mouse users to work down through one column of content before moving to the next column, make sure the focus order follows that path.

#### 3.1 Visible focus

Components must provide a visible indication when they have the input focus.

1. Use the keyboard to navigate through all the interactive interface components in the target page.

    1. Use **Tab** and **Shift+Tab** to navigate between widgets both forwards and backwards.
    2. Use the arrow keys to navigate between the focusable elements within a composite widget.

2. As you move focus to each component, verify that it provides a visible indication that it has received the focus.

#### 3.2 Revealing content

Activating a component that reveals hidden content must move input focus into the revealed content.

1. Examine the target page to identify any "trigger" components (typically buttons or links) that reveal hidden menus or dialogs.
2. Use the keyboard to activate each trigger component.
3. Verify that focus is moved into the revealed content. (It is acceptable to **Tab** once or use an arrow key to move focus into the revealed content.)

#### 3.3 Modal dialogs

Users must not be able to Tab away from a modal dialog without explicitly dismissing it.

1. Examine the target page to identify any "trigger" components that open modal dialogs.
2. Use the keyboard to activate each trigger component.
3. Use the **Tab** and arrow keys as needed to move focus all the way through the content of the dialog.
4. Verify that you cannot move focus out of any modal dialog using just the **Tab** or arrow keys.

#### 3.4 Closing content

Closing revealed content must return input focus to the component that revealed it.

1. Use the keyboard to activate any trigger component that reveals hidden content, such as menus, dialogs, expandable tree views, etc.
2. If needed, use the **Tab** or arrow key to move focus into the revealed content.
3. Use the keyboard to close or hide the revealed content.
4. Verify that focus returns to the original trigger component. (It is acceptable to use **Shift+Tab** once or use an arrow key to move focus to the trigger.)

#### 3.5 Focus order

Components must receive focus in an order that preserves meaning and operability.

1. Use the keyboard to navigate through all the interactive interface components in the target page.

    1. Use **Tab** and **Shift+Tab** to navigate between widgets both forwards and backwards.
    2. Use the arrow keys to navigate between the focusable elements within a composite widget.

2. If you encounter any trigger component that reveals hidden content:

    1. Activate the trigger.
    2. Navigate through the revealed content.
    3. Close the revealed content.
    4. Resume navigating the page.

3. Verify that all interactive interface components receive focus in an order that preserves the meaning and operability of the web page.

#### 3.6 Focus not obscured (new for WCAG 2.2)

For elements receiving keyboard focus, its focus indicator must be at least partially visible and not obscured by author-created content which overlays it, unless the focused element can be revealed without requiring the user to advance focus in the UI.

Note: the AAA criterion Focus Not Obscured (Enhanced) calls for focusable elements to be entirely unobscured when receiving keyboard focus.

1. Use the keyboard to navigate through all the interactive interface components in the target page.

    1. Use **Tab** and **Shift+Tab** to navigate between widgets both forwards and backwards.
    2. Use the arrow keys to navigate between the focusable elements within a composite widget.

2. As you move focus to each component, verify that the focused element is not completely obscured by other content.

Note: Focus can be obscured by user rendered content and still pass this requirement if that content can be dismissed via a keyboard command (e.g., pressing the Escape key).
