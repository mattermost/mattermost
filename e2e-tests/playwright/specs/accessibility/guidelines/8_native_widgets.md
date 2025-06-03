### 8 Native Widgets

Widgets are interactive interface components, such as links, buttons, and combo boxes.

Native widgets include the following simple, interactive HTML elements:

- `button`
- `input`
- `select`
- `textarea`

However, native widgets can function as custom widgets. For example, a button might function as part of an accordion control or menu; or a text field, a button, and a listbox might function together as a combo box.

WCAG success criteria:

- [4.1.2: Name, Role, Value](https://www.w3.org/WAI/WCAG21/Understanding/name-role-value.html)
- [1.3.1: Info and Relationships](https://www.w3.org/WAI/WCAG21/Understanding/info-and-relationships.html)
- [2.5.3: Label in Name](https://www.w3.org/WAI/WCAG21/Understanding/label-in-name.html)
- [3.3.2: Labels or Instructions](https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions.html)
- [1.3.5: Identify Input Purpose](https://www.w3.org/WAI/WCAG21/Understanding/identify-input-purpose.html)

#### Do

If a native widget functions as a custom widget, give it the appropriate ARIA widget role. (WCAG 4.1.2)

- Familiarize yourself with the ARIA design patterns for custom widgets.
- Determine which design pattern your widget should follow.
- Add the correct widget role. (Some complex widgets require more than one role.)

If a widget has visible label or instructions, make sure they are programmatically related to it. (WCAG 1.3.1, WCAG 2.5.3)

- A widget's visible label should be included in its accessible name.
- Any additional instructions that are visible should be included in the widget's accessible description.

Use the widget's accessible name and/or accessible description to identify the expected input. (WCAG 3.3.2)

- For example, a button should indicate what action it will initiate. A text field should indicate what type of data is expected and whether a specific format is required.

For any form field that serves an identified input purpose, provide the appropriate HTML 5.2 autocomplete attribute. (WCAG 1.3.5)

Make sure the widget provides the appropriate cues if it is disabled, read-only, or required. (WCAG 1.3.1, WCAG 4.1.2)

- Use HTML5 attributes for indicating these states.

#### Don't

Don't rely on a widget's visual characteristics to communicate information to users. (WCAG 1.3.1)

- Information communicated visually must also be communicated programmatically.

#### 8.1 Widget function

If a native widget **functions** as a custom widget, it must have the appropriate ARIA widget role.

1. In the target page, examine each native widget that is a possible custom widget to verify that it **functions** as a simple native widget.

Note: Native widgets that are possible custom widgets are those that don't have an ARIA widget role, but they do have some custom widget markup, such as `tabindex="-1"`, an ARIA attribute, or a non-widget role.

#### 8.2 Instructions

If a native widget has a visible label or instructions, they must be programmatically determinable.

1. In the target page, examine each native widget (`<button>`, `<input>`, `<select>`, and `<textarea>` elements) to determine whether it has a visible label or instructions.
2. If a widget does have a visible label or instructions, verify that they are programmatically determinable:
    1. The accessible name must be (or include) an exact match of any visible text label.
    2. The accessible description must include any additional visible instructions. If any non-text instructions are provided (for example, icons or color changes), the accessible description must include a text equivalent.

#### 8.3 Expected input

A native widget must have a label and/or instructions that identify the expected input.

1. Examine each native widget to verify that its accessible name and/or instructions identify the expected input, including any unusual or specific formatting requirements.

#### 8.4 Cues

If a native widget adopts certain interactive states, it must provide appropriate cues.

1. In the target page, interact with each native widget (`<button>`, `<input>`, `<select>`, and `<textarea>` elements) to determine whether it adopts any of these states:
    1. Disabled
    2. Read-only
    3. Required
2. If a widget **does** adopt any of these states, inspect its HTML using the browser Developer Tools to verify that the states are appropriately coded.
    1. HTML properties (e.g., `readonly`) should be used on elements that support them.
    2. ARIA properties (e.g., `aria-readonly`) should be used on elements that don't support HTML properties.

#### 8.5 Autocomplete

Text fields that serve certain purposes must have the correct HTML5 `autocomplete` attribute.

1. In the target page, examine each text field to determine whether it serves an identified input purpose.
2. If a text field **does** serve an identified input purpose, verify that it has an **autocomplete** attribute with the correct value.
