### 9 Custom Widgets

A **widget** is an interactive interface component, such as a link, button, or combo box.

A **custom widget** is an interactive interface component other than a link or native HTML element. Custom widgets can be simple (e.g., a link or a button) or complex (e.g., a text field, listbox, and button that together function as a combo box).

Each custom widget should follow the ARIA design pattern that best describes its function.

WCAG success criteria:

- [1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
- [2.1.1: Keyboard](https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html)
- [2.5.3: Label in Name](https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html)
- [3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
- [4.1.2: Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html)

#### Do

Use the correct ARIA widget role for the custom widget's design pattern. (WCAG 4.1.2)

- Familiarize yourself with the ARIA design patterns for custom widgets.
- Determine which design pattern best describes the widget's function.
- Add the appropriate widget role.

If a widget has visible instructions, make sure they are programmatically related to it. (WCAG 1.3.1, WCAG 2.5.3)

- A widget's visible label should be included in its accessible name.
- Any additional instructions that are visible should be included in the widget's accessible description.

Use the widget's accessible name or accessible description to identify the expected input. (WCAG 3.3.2)

- For example, a button should indicate what action it will initiate. A text field should indicate what type of data is expected and whether a specific format is required.

Use the roles, states, and properties specified by the ARIA design patterns. (WCAG 4.1.2)

Provide appropriate cues when a widget is disabled, read-only, or required. (WCAG 1.3.1, WCAG 4.1.2)

Support the keyboard interaction specified by the design pattern. (WCAG 2.1.1)

#### Don't

Don't rely on a widget's visual characteristics to communicate information to users. (WCAG 1.3.1)

- State information communicated visually (for example, graying out a disabled widget) must also be communicated programmatically (for example, by adding the aria-disabled attribute).

Don't use a custom widget when a native widget will do. (best practice)

- As a rule, it's better to use native semantics than to modify them using ARIA roles.

#### 9.1 Design pattern

A custom widget must have the appropriate ARIA widget role for its design pattern.

1. Familiarize yourself with the ARIA design patterns for custom widgets.
2. In the target page, examine each custom widget to determine which design pattern best describes its function.
3. Verify that the custom widget has the right role for its design pattern.

#### 9.2 Instructions

If a custom widget has a visible label or instructions, they must be programmatically determinable.

1. In the target page, examine each custom widget (element with a valid ARIA widget role) to determine whether it has a visible label or instructions.
2. If a widget does have a visible label or instructions, verify that they are programmatically determinable:
    1. The accessible name must be (or include) an exact match of the visible text label.
    2. The accessible description must include any additional visible instructions. If any non-text instructions are provided (for example, icons or color changes), the accessible description must include a text equivalent.

#### 9.3 Expected input

A custom widget must have a label and/or instructions that identify the expected input.

1. Examine each custom widget to verify that its accessible name and/or instructions identify the expected input, including any unusual or specific formatting requirements.

#### 9.4 Role, state, property

A custom widget must support the ARIA roles, states, and properties specified by its design pattern.

1. For each custom widget, use the design pattern that best describes the widget's function.
2. Familiarize yourself with the "WAI-ARIA Roles, States, and Properties" section of the design pattern spec.
3. Inspect the widget's HTML using the Accessibility pane in the browser Developer Tools to verify that it supports all of the roles, states, and properties specified by its design pattern:
    - For a composite widget, use the Accessibility Tree to verify the role hierarchy. (For example, verify that a menuitem exists for each option in a menubar.)
    - View the widget's ARIA Attributes while you interact with it to verify that required properties update according to spec. (For example, when a tree node in a tree view is expanded, aria-expanded is "true" and when it isn't expanded, it is "false".)

#### 9.5 Cues

If a custom widget adopts certain interactive states, it must communicate those states programmatically.

1. In the target page, interact with each custom widget to determine whether it adopts any of these states:
    1. Disabled
    2. Read-only
    3. Required
2. If a widget **does** adopt any of these states, inspect its HTML using the browser Developer Tools to verify that the states are appropriately coded.
    1. HTML properties (e.g., **readonly**) should be used on elements that support them.
    2. ARIA properties (e.g., **aria-readonly**) should be used on elements that don't support HTML properties.

#### 9.6 Keyboard interaction

A custom widget must support the keyboard interaction specified by its design pattern.

1. For each custom widget, open the spec for the design pattern that best describes the widget's function.
2. Familiarize yourself with the "Keyboard Interaction" section of the spec.
3. Interact with the widget to verify that it supports the keyboard interactions specified by its design pattern.
