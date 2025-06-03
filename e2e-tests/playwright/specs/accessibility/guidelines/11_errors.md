### 11 Errors

As much as possible, websites and web apps should help users avoid making mistakes, especially mistakes with consequences that can't be reversed, such as buying non-refundable airline tickets or transferring money to a bank account. When users do make a data entry error, they need to easily find it and fix it.

WCAG success criteria:

- [3.3.1: Error Identification](https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html)
- [3.3.3: Error Suggestion](https://www.w3.org/WAI/WCAG21/Understanding/error-suggestion.html)
- [3.3.4: Error Prevention (Legal, Financial, Data)](https://www.w3.org/WAI/WCAG21/Understanding/error-prevention-legal-financial-data.html)
- [4.1.3: Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)

#### Do

Identify and describe input errors in text. (WCAG 3.3.1)

- Clarify whether input is missing, out of the allowed range, or in an unexpected format.
- It's ok to use visual cues in addition to the text.

Provide suggestions for correcting input errors.(WCAG 3.3.3)

- Clarify the type of input required, the allowed values, and the expected format.

Allow users to correct input errors before finalizing a submission. (WCAG 3.3.4)

- Make submissions reversible, and/or
- Check user input for errors, and give users an opportunity to make corrections, and/or
- Allow users to review, correct, and confirm their input before finalizing a submission.

Make status messages programmatically determinable by using the appropriate ARIA role. (WCAG 4.1.3)

- If the status message contains important, time-sensitive information that should be communicated to users immediately (potentially clearing the speech queue of previous updates), `userole="alert"`, which has an `implicitaria-livevalue` of assertive.
- Otherwise, use a role with an implicit `aria-live` value of polite:
    - Use `role="status"` for a simple status message that's not urgent enough to justify interrupting the current task.
    - Use `role="log"` if new information is added to the status message in meaningful order, and old information might disappear (such as a chat log, game log, error log, or messaging history).
    - Use `role="progressbar"`if the message conveys the status of a long-running process.

#### Don't

Don't identify input errors using only visual cues, such as changes in color or icons. (WCAG 3.3.1)

- Always describe the error using text.

#### 11.1 Error identification

If an input error is automatically detected, the item in error must be identified, and the error described, in text.

1. Examine the target page to identify any input fields with automatic error detection, such as:
    1. Required fields
    2. Fields with required formats (e.g., date)
    3. Passwords
    4. Zip code fields
2. If you find such an input field, enter an incorrect value that triggers automatic error detection.
3. Verify that:
    1. The field with the error is identified in text, and
    2. The error is described in text.

#### 11.2 Error suggestion

If an input error is automatically detected, guidance for correcting the error must be provided.

1. Examine the target page to identify any input fields with automatic error detection, such as:
    1. Required fields
    2. Fields with required formats (e.g., date)
    3. Passwords
    4. Zip code fields
2. If you find such an input field, enter an incorrect value that triggers automatic error detection.
3. Examine the error notification to verify that guidance for correcting the error is provided to the user (unless it would jeopardize the security or purpose of the content).

#### 11.3 Error prevention

If submitting data might have serious consequences, users must be able to correct the data input before finalizing a submission.

1. Examine the target page to determine whether it allows users to:
    1. Make any legal commitments or financial transactions, or
    2. Modify or delete data in a data storage system, or
    3. Submit test responses.
2. If the page **does** allow such actions, verify that at least one of the following is true:
    1. Submissions are reversible.
    2. Data entered by the user is checked for input errors, and the user is given an opportunity to correct them.
    3. The user can review, confirm, and correct information before finalizing the submission.

#### 11.4 Status messages

Status messages must be programmatically determinable without receiving focus.

1. Examine the target page to determine whether it generates any status messages. A status message provides information to the user on any of the following:
    1. The success or results of an action
    2. The waiting state of an application
    3. The progress of a process
    4. The existence of errors
2. Refresh the page.
3. Inspect the page's HTML to identify an empty container with one of the following attributes:
    1. `role="alert"`
    2. `role="log"`
    3. `role="progressbar"`
    4. `aria-live="assertive"`
4. Trigger the action that generates the status message.
5. Verify that the status message is injected into the container.
