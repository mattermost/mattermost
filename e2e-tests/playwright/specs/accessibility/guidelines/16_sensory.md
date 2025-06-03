### 16 Sensory

When color, shape, location, audio, or other sensory characteristics are the only means used to convey information, people with disabilities do not have access to the same information that others have. Meaning communicated through sensory characteristics must also be available in a textual format that can be viewed by all users and read by screen reader software.

WCAG success criteria:

- [1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
- [1.4.1: Use of Color](https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html)
- [1.3.3: Sensory Characteristics](https://www.w3.org/WAI/WCAG21/Understanding/sensory-characteristics.html)

#### Do

Feel free to use color redundantly to convey information.

- Color can be a powerful method for communicating things like function, category, or status.
  Feel free to use audio cues redundantly to convey information.
- Audio cues can draw the user's attention to important events or state changes.

#### Don't

Don't use color as the only visual means of conveying information. (WCAG 1.4.1)

- Combine color with other visual aspects, such as shape, color, size symbols, or text.

Don't offer instructions that rely solely on color or other sensory characteristics to identify user interface components. (WCAG 1.3.3)

- Sensory characteristics include color, shape, size, visual location, orientation, and sound.
- Incorporating text is the best way to ensure your instructions don't rely on sensory characteristics.
    - Bad: To submit the form, press the green button.
    - Good: To submit the form, press the green 'Go' button.
    - Bad: To view course descriptions, use the links to the right.
    - Good: To view course descriptions, use the 'Available courses' links to the right.

Don't use audio as the only means of conveying information. (WCAG 1.1.1)

- Convey the same information visually, such as through text or icons.

Don't show content that flashes more than three times per second. (WCAG 2.3.1)

- Content that flashes at certain frequencies can trigger seizures in people with photosensitive seizure disorders.

#### 16.1 Color as meaning

Visual information used to identify active user interface components and their states must have sufficient contrast.

1. Examine the target page to identify any instances where color is used to communicate meaning, such as:
1. Communicating the status of a task or process
1. Indicating the state of a UI component (such as selected or focused)
1. Prompting a response
1. Identifying an error
1. For each instance, verify that at least one of these visual alternatives is also provided:
1. On-screen text that identifies the color itself and/or describes the meaning conveyed by the color
1. Visual differentiation (e.g., shape, position, size, underline) and a clear indication of its meaning

#### 16.2 Instructions

Instructions must not rely solely on color or other sensory characteristics.

1. Examine the target page to identify any instances where instructions refer to an element's sensory characteristics, such as:
1. Color
1. Shape
1. Size
1. Visual location
1. Orientation
1. Sound

1. For each instance, verify that the instructions also include additional information sufficient to locate and identify the element without knowing its sensory characteristics. (For example, "Press the green button").

#### 16.3 Auditory cues

Auditory cues must be accompanied by visual cues.

1. Interact with the target page to identify any instances where the system provides auditory cues, such as:

- A tone that indicates successful completion of a process
- A tone that indicates arrival of a message

2. For each instance, verify that the system also provides a visible cue.
