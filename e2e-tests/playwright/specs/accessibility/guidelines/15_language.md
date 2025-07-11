### 15 Language

Screen reader technologies can adjust their pronunciation based on language, but only if the language is coded correctly. If language changes are not identified, for a screen reader user, the speech will sound awkward at best, or unintelligible at worst.

WCAG success criteria:

- [3.1.1: Language of Page](https://www.w3.org/WAI/WCAG21/Understanding/language-of-page.html)
- [3.1.2: Language of Parts](https://www.w3.org/WAI/WCAG21/Understanding/language-of-parts.html)

#### Do

Define the correct default language for the page.(WCAG 3.1.1)

- Use the correct lang attribute on the page's `<html>` element.
- An automated check will fail if the `<html>` element's lang attribute is missing or invalid.

Define the correct language for any passage in a different language. (WCAG 3.1.2)

- Add the correct lang attribute to an element that contains the text.
- An automated check will fail if any element has an invalid lang attribute.

Define the correct text direction if the language uses a script that's read right-to-left. (WCAG 1.3.2)

- If the default language of the page is read right-to-left, add `dir="rtl"` to the page's `<html>` element.
- If only a passage is read right-to-left, add `dir="rtl"` to the element that contains the passage.

#### 15.1 Language of page

A page must have the correct default language.

1. Examine the target page to determine its primary language.
2. Inspect the page's `<html>` tag to verify that it has the correct language attribute.

#### 15.2 Language of parts

If the language of a passage differs from the default language of the page, the passage must have its own language attribute.

1. Examine the target page to identify any passages in a language different from the default language of the page.
2. If you find such a passage, examine the containing element's HTML to verify that it has the correct language attribute.

#### 15.3 Text direction

If a page or a passage uses a script that is read right-to-left, it must have the correct text direction.

1. Examine the target page to determine whether the page uses a right-to-left script - such as Arabic, Hebrew, Persian or Urdu.
2. If the page or a passage does use a right-to-left script, examine the containing element's HTML to verify that it has the correct direction attribute (`dir="rtl"`).
