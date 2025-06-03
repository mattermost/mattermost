### 10 Timed Events

People who use screen readers or voice input and people with cognitive disabilities might need more time than other users to assimilate the information and execute the controls on a website or web app. People who have trouble focusing might need a way to decrease the distractions created by movement in an application. People who use screen readers might find it hard to hear the speech output if there is other audio playing at the same time.

WCAG success criteria:

- [2.2.1: Timing Adjustable](https://www.w3.org/WAI/WCAG21/Understanding/timing-adjustable.html)
- [1.4.2: Audio Control](https://www.w3.org/WAI/WCAG21/Understanding/audio-control.html)
- [2.2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html)

#### Do

Allow users to turn off, adjust, or extend any time limits set by the content. (WCAG 2.2.1)

- Allow users to turn off the time limit, or
- Allow users to adjust the time limit so it is at least 10 times longer than the default, or
- Warn users about the time limit, give them at least 20 seconds to extend the time limit through a simple action (such as pressing the spacebar), and allow them to extend the time limit at least 10 times.

Allow users to pause, stop, or hide any content that moves, blinks, or scrolls automatically for more than five seconds. (WCAG 2.2.2)

- Good: Provide a mechanism for users to pause, stop, or hide the moving content, or
- Better: Stop the moving content automatically after five seconds, or
- Best: Don't show moving content automatically.

Allow users to pause, stop, hide, or control the update frequency of any content that updates automatically. (WCAG 2.2.2)

Allow users to pause, stop, or mute any audio content that plays automatically for more than three seconds. (WCAG 1.4.2)

- Good: Provide a mechanism for users to pause, stop, or mute the audio content without affecting the overall system volume, or
- Better: Make the audio stop after three seconds, or
- Best: Do not play audio automatically.

#### Don't

Don’t use `http-equiv="refresh"` on `<meta>` tags. (WCAG 2.2.1)

- This attribute creates a timed refresh that users can't control.
- An automated check will fail if this this attribute is detected.

Don’t use `<blink>` or `<marquee>` tags.(WCAG 2.2.2)

- These tags create blinking and moving content that users can't control.
- An automated check will fail if these tags are detected.

#### 10.1 Time limits

If a time limit is set by the content, the user must be able to turn off, adjust, or extend the time limit.

1. Examine the target page to determine whether it has any content time limits (time-outs).

    1. Ignore any time limit that is:
        1. Part of a real-time event (such as an auction), and no alternative to the time limit is possible; or
        2. Essential to the activity (such as an online test), and allowing users to extend it would invalidate the activity; or
        3. Longer than 20 hours.

2. If the page **does** have a time limit, verify that:
    1. You can turn off the time limit, or
    2. You can adjust the time limit to at least 10 times the default limit, or
    3. You are:
        1. Warned about the time limit, and
        2. Given at least 20 seconds to extend the time limit with a simple action (e.g., "Press the space bar"), and
        3. Allowed to extend the time limit at least 10 times.

#### 10.2 Audio control

If audio content plays automatically for longer than three seconds, users must be able to pause or mute it.

1. Examine the target page to determine whether it has any audio that:
    1. Plays automatically, and
    2. Lasts more than three seconds.
2. If you find such audio, verify that a mechanism is available, either at the beginning of the page/screen content or in platform accessibility features, that allows you to:
    1. Pause or stop the audio, or
    2. Control audio volume independently from the overall system volume level.

#### 10.3 Moving content

If content moves, blinks, or scrolls automatically for more than five seconds, users must be able to pause, stop, or hide it.

1. Examine the target page to identify any information that:
    1. Moves, blinks, or scrolls, and
    2. Starts automatically, and
    3. Lasts more than 5 seconds, and
    4. Is presented in parallel with other content, and
    5. Is not part of an activity where it is essential.
2. If you find such content, verify that you can pause, stop, or hide it.

#### 10.4 Auto-updating content

If content updates automatically, users must be able to pause, stop, hide, or control frequency of the updates.

1. Examine the target page to identify any content that:
    1. Updates, and
    2. Starts automatically, and
    3. Is presented in parallel with other content, and
    4. Is not part of an activity where it is essential.
2. If you find such content, verify that you can pause, stop, or hide it, or control the update frequency.
