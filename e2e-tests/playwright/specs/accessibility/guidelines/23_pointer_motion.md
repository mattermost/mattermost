### 23 Pointer Motion

The requirements in this test ensure that functionality operated through pointers (mouse, touch, stylus) or motion can be used successfully by everyone.

WCAG success criteria:

- [2.5.1: Pointer Gestures](https://www.w3.org/WAI/WCAG21/Understanding/pointer-gestures)
- [2.5.2: Pointer Cancellation](https://www.w3.org/WAI/WCAG21/Understanding/pointer-cancellation.html)
- [2.5.4: Motion Actuation](https://www.w3.org/WAI/WCAG21/Understanding/motion-actuation.html)

#### Do

Give users a method to cancel any function that they initiate using a single pointer. (WCAG 2.5.2)

- Don't use the down event to trigger any part of the function, or
- Initiate the function using the down event, but complete the function only on the up event, and provide a way for users abort or undo the function, or
- Complete the function on the down event, but use the up event to reverse the outcome of the preceding down event.

#### Don't

Don't require multipoint or path-based gestures. (WCAG 2.5.1)

- Provide an alternative method that requires only a single pointer and doesn't depend on the path of the pointer's movement.

Don't require motion operation. (WCAG 2.5.4)

- Make sure users can operate all functionality using UI components, and
  Give users the option of disabling motion operation.

#### 23.1 Pointer gestures

Functions must be operable without requiring multipoint or path-based gestures.

1. Examine the target page to identify any functions that can be operated using either of the following:

- Multipoint gestures, such as a two-fingered pinch zoom or a three-fingered tap.
- Path-based gestures, such as dragging or swiping.

2. Verify that the function is also operable using a single-point, non-path-based gesture, such as a double-click or a long press.

Exception: Multi-point and path-based gestures are allowed where they are essential to the underlying function, such as freehand drawing.

#### 23.2 Pointer cancellation

Users must be able to cancel functions that can be operated using a single pointer.

1. Examine the target page to identify any functions that can be operated using a single pointer.
2. Verify that at least one of the following is true:
    1. **No down-event.** The down-event of the pointer is not used to execute any part of the function.
    2. **Abort or Undo.** Completion of the function is on the up-event, and a mechanism is available to abort the function before completion or to undo the function after completion.
    3. **Up reversal.** The up-event reverses any outcome of the preceding down-event.

Exception: This requirement does not apply if completing the function on the down-event is essential to the underlying function. For example, for a keyboard emulator, entering a key press on the down-event is considered essential.

#### 23.3 Motion operation

If a function can be operated through motion, it must also be operable through user interface components.

1. Examine the target page to identify any functions that can be operated by device motion (such as shaking) or user motion (such as walking).
2. Verify that both of the following are true:

- The function is also operable through user interface components (such as a toggle button).
- Motion operation can be disabled by the user.

Exception: This requirement does not apply if motion activation is essential to the underlying function, such as tracking a user’s steps.

#### 23.4 Dragging movements

The action of dragging cannot be the only means available to perform an action, with exceptions on where dragging is essential to the functionality, or the dragging mechanism is not built by the web author (e.g., native browser functionality unmodified by the author).

1. Examine the target page to identify elements that support dragging (such as press and hold, repositioning of pointer, releasing the pointer at end point).
2. Verify that there is an single pointer activation alternative that does not require dragging to operate the same function.

Exception: This criterion does not apply to scrolling enabled by the user-agent. Scrolling a page is not in scope, nor is using a technique such as CSS overflow to make a section of content scrollable. This criterion also applies to web content that interprets pointer actions (i.e. this does not apply to actions that are required to operate the user agent or assistive technology).

#### 23.5 Target size

Touch targets must have sufficient size and spacing to be easily activated without accidentally activating an adjacent target.

1. Examine the target page to identify interactive elements which have been created by authors (non-native browser controls).
2. Verify these elements are a minimum size of 24x24 css pixels. The following exceptions apply:

- `Spacing`: These elements may be smaller than 24x24 css pixels so long as it is within a 24x24 css pixel target spacing circle that doesn’t overlap with other targets or their 24x24 target spacing circle.
- `Equivalent`: If an alternative control is provided on the same page that successfully meets the target criteria.
- `Inline`: The target is in a sentence, or its size is otherwise constrained by the line-height of non-target text.
- `User agent control`: The size of the target is determined by the user agent and is not modified by the author.
- `Essential`: A particular presentation of the target is essential or is legally required for the information to be conveyed.
