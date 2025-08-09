### 25 Cognitive

When interfaces require repetitive entry of user data or necessitate that users recall information, solve problems or transcribe information to login, it can unnecessarily increase the cognitive load a user must handle. For people with cognitive and/or learning disabilities, increasing cognitive load in these ways can lead to unnecessary errors with data entry or create barriers to login to websites or applications.

WCAG success criteria:

- [3.3.7: Redundant Entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html)
- [3.3.8: Accessible Authentication (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html)

#### Do

Provide users functionality to Copy & paste passwords for authentication. (WCAG 3.3.8)

Create systems with 2-factor authentication with verification codes to prevent higher cognitive recall. (WCAG 3.3.8)

#### Don't

Don't rely on users memorizing or transcribing a username, password, or one-time verification code. (WCAG 3.3.8)

Don't require people to re-enter information they have already provided via other means. (WCAG 3.3.7)

- Ensure processes do not rely on memory.
- Memory barriers stop people with cognitive disabilities from using content. This includes long passwords to log in and voice menus that involve remembering a specific number or term. Make sure there is an easier option for people who need it.

#### 25.1 Redundant entry

Do not require people to re-enter information they have already provided via other means – e.g., as part of a previous step in the same form.

1. Examine the target page to identify user input mechanisms that request information to be entered (for example form fields, passwords, etc.)
2. Verify if the information has already been requested on a previous step of the process and that the information entered previously is prepopulated in the fields or displayed on the page. If either of these conditions fail, the test is considered a failure.

#### 25.2 Authentication

People with cognitive issues relating to memory, reading (for example, dyslexia), numbers (for example, dyscalculia), or perception-processing limitations will be able to authenticate irrespective of the level of their cognitive abilities.

Note: Text-based personal content does not qualify for an exception as it relies on recall (rather than recognition), and transcription (rather than selecting an item).

1. Examine the target page to identify the input fields and verify whether they prevent the user from pasting or auto-filling the entire password or code in the format in which it was originally created.
2. Confirm whether any other acceptable authentication methods are present that satisfy the criteria such as an authentication method that does not rely on a cognitive function test.
