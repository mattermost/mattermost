### 13 Parsing

The requirements in this test ensure that parsing errors don't disrupt assistive technology.

WCAG success criteria:

- [4.1.1: Parsing](https://www.w3.org/WAI/WCAG21/Understanding/parsing.html)

#### Do

Ensure that assistive technologies can accurately parse your page’s content. (WCAG 4.1.1)

- Elements must be nested according to their specifications.
- Elements must have complete start and end tags.
- Elements must not contain duplicate attributes.

#### 13.1 Parsing

Elements must have complete start and end tags, must not contain duplicate attributes, and must be nested according to their specifications.

1. Use an HTML validator (such as the Nu HTML Checker) to validate the page's markup.
2. Examine the validation results to verify that there are no errors related to:
    1. Missing start or end tags
    2. Duplicate attributes
    3. Improper nesting of elements
