# Web App Style Guide

## Introduction

This is the style guide for the Mattermost Web App. It establishes strict rules and more general recommendations for how code in the app should be written. It also builds on the rules enforced by automated tooling by establishing how our code should be written in cases which either cannot be enforced by that tooling or in cases where there's room for developer discretion.

### Automated style checking and linting

Whenever possible, we should use automated tooling (ESLint for our JavaScript/TypeScript code and Stylelint for our CSS/SCSS code) to enforce code style rules and linter checks. By making those automated, they can be enforced automatically by CI and developers' editors. That makes it easier to ensure that those checks are always applied without giving reviewers extra work, and it makes sure that they are applied evenly across the code base.

### Application of guidelines

The following guidelines should be applied to both new and existing code. However, this does not mean that a developer is *required* to fix any surrounding code that contravenes the rules in the style guide. It's encouraged to keep fixing things as you go, but it's not compulsory to do so. Reviewers should refrain from asking for stylistic changes in surrounding code if the submitter has not included them in their pull request.

## Guidelines

### React Component Structure

- **Functional Components**: New components should be written as functional components whenever possible.
- **Breaking Up Component Code**: Avoid writing individual components containing large amounts of code. Look for opportunities to break up the logic in larger components into either smaller components or by moving logic into hooks.
- **Accessing Redux**: Prefer the `useSelector`/`useDispatch` hooks instead of using `connect` for new components.
- **Callbacks And Memoization**: When passing callbacks into child components, `useCallback` should be used to reduce re-rendering. Similarly, use `useMemo` when constructing arrays or objects to pass into child components.
- **Component Memoization**: Use `React.memo` to wrap components with a lot of internal logic that happens on render, but avoid it for components that are cheap to render.
- **Code Splitting**: Use the `makeAsyncComponent` wrapper to allow for code splitting to separate out heavy routes and components into separate bundles.

### Styling & Theming

- **Co-location**: Prefer putting styles for a component in a SCSS file alongside the corresponding component. For example, `my_component.scss` should be next to `my_component.tsx`. Import those styles directly into the corresponding component.
- **Scope & Naming**:
    - **Root Classes**: All styles for a component should be wrapped in a root class matching the name of the component in PascalCase (e.g. `MyComponent`).
    - **Child Elements**: Classes for child elements should be written as a BEM-style suffix on the component's root class. For example, a title of a component named `MyComponent` would have the class `MyComponent__title`.
    - **Modifiers**: When applying a class to modify a component, that should be done as a separate CSS class applied to styled element. For example, a compact verison of `MyComponent` would be styled by putting a `&.compact` rule inside of `.MyComponent`.
    - **Internal Consistency**: Class names in our existing code aren't always consistent. While the guidelines above should be applied to new code, try to follow the established naming conventions in a file when working on that file.
- **Avoid !important**: Avoid using `!important`. The naming conventions above should help prevent conflicts, but if they don't, consider renaming classes or reducing the specificity of the conflicting CSS.
- **Theming and Colors**:
    - **Colors**: In themed areas of the app, always use theme variables for colors (e.g. `color: var(--link-color)`). Don't hard code color values in those areas. A list of all of those variables are available in `channels/src/sass/base/_css_variables.scss`.
    - **Transparency**: For non-opaque colors, use `rgba` with the versions of theme variables suffixed with `-rgb` (e.g. `color: rgba(var(--link-color-rgb), 0.8))`).

### Accessibility

- **Reusing Components**: Whenever possible, use existing components (for example, `GenericModal` or `Menu`) instead of writing new components because those components should already follow standard accessibility patterns.
- **Prefer Semantic HTML**: When writing a new component, use semantic HTML elements such as `button`, `input`, `h2`, or `ul` instead of more general ones like `div` or `span`. Those elements are accessible by default, and more general elements need additional attributes and logic to be similarly accessible.
- **Accessible Names**:
    - Interactive elements and some other elements like tables or regions must have an accessible name. An accessible name should be short (only 1 to 3 words long), explain the purpose of an element, and be able to be differentiated between other elements on a page. Additional information about the element can go in the description (see below).
    - An accessible name can come from the text in an element (such as a `button`), a form control's corresponding `label` element, another element linked using the `aria-labelledby` attribute, or from the `aria-label` attribute. Prefer using methods other than `aria-label` when possible to ensure the accessible name matches visible labels whenever possible because some sighted users will still use accessibility tools to navigate the app.
    - Don't repeat information in the label that is already available to the user through the `role` or other `aria-` attributes. For example, don't include the word "button" in a button's accessible name.
    - For more information, see [the Providing Accessible Names and Descriptions page of the ARIA APG](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/).
- **Accessible Descriptions**:
    - An accessible description should be added to an element to provide additional information to the user that might otherwise only be available to a sighted user. This includes information like text that a non-sighted user may not connect to an associated element (such as the help or error text for an input box) or information that's part of an element but not the primary focus (such as the online status of a user in a selection box). The description can also include additional information that may only be needed by non-sighted or keyboard-only users (such as information about custom keyboard interactions for that element).
    - An accessible description can come from the `aria-describedby` attribute or the `aria-description` attribute. Prefer using `aria-describedby` because it has wider support and because it can reuse existing help text that may already be present in the app.
    - Don't repeat information in the description that is already available to the user through other `aria-` attributes. For example, don't include the expanded/collapsed state on an element with `aria-expanded` on it.
- **Text For Images**:
    - All images and icons should have a text equivalent as long as that information isn't available some other way. For example, a status icon on a user's profile picture may need an `alt` attribute or `aria-label`, but a user's profile picture next to their name in the UI may not.
    - Don't include the words "image" or "icon" in an image's alt text or `aria-label`. Those are already read out by accesibility tools.
- **Custom Interactive Elements**: When not able to use a semantic element for a component, ensure the following conditions are met:
    - **Focusability**: Interactive elements must be focusable and "visible" when using only the keyboard. If an element only appears on hover, it must still be accessible when navigating using the keyboard.
    - **Standard Keyboard Support**: Interactive elements must support standard keyboard behavior such as are described by [the Patterns section of the ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/). For example, buttons and links should trigger when the enter key or space bar is pressed while radio buttons or tabs should be navigable using the arrow keys. When no standard pattern exists, all functionality should still be usable with only the keyboard, although it may be accessible using other means. For components that aren't covered by the ARIA API patterns, see [the Developing a Keyboard Interface](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/) instead.
    - **Readability**: Whenever possible, custom elements must have a `role` specified. They must also have any additional information defined using `aria-` attributes as defined in the [ARIA APG](https://www.w3.org/WAI/ARIA/apg/). For example, a custom checkbox should have its checked state denoted using `aria-checked` while a menu should have its open/closed state denoted using `aria-expanded`.
- **Keyboard Focus**:
    - **Visible Keyboard Focus**: The focused element should be visible to users if and only if they're navigating using the keyboard. In our code base, this is usually done using the `a11y--focused` CSS class, but it would ideally be done using the `:focus-visible` pseudoclass.
    - **Predictable Keyboard Focus**: Keyboard focus should move predictably between elements and should only jump when a user would expect it. For example, when opening a modal, keyboard focus should move into that modal. Similarly, when closing a modal, keyboard focus should return to the button or menu that opened the modal unless there is somewhere more applicable for it to move. For more information, see [the Discernable and Predictable Keyboard Focus section of the ARIA APG](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#discernibleandpredictablekeyboardfocus).
- **Keyboard Shortcuts**:
    - **Different Keyboard Layouts**: Use `isKeyPressed(event, Constants.KeyCodes.KEY_NAME)` instead of raw key codes to support different keyboard layouts.
    - **Platform-specific Shortcuts**: Use `cmdOrCtrlPressed(event)` to have shortcuts using the Ctrl key to have them use the Cmd key on MacOS.
    - **Scoping Keyboard Event Handlers**: Ensure that keyboard event handlers for keyboard shortcuts are on an appropriate element instead of being on the document. This helps avoid conflicting hotkeys and allows for the use of `stopPropagation` to handle any conflicts that do occur. If that's not possible, use `event.target` to ensure that the keyboard shortcut isn't firing when it shouldn't be (such as when pressing escape to close a menu also causes the parent modal to close).
- **A11yController**: The `A11yController` provides additional keyboard support for elements in the app based on their CSS class and attributes.
    - **Regions**: Add the `a11y__region` class and a `data-a11y-sort-order` attribute to major regions of the UI to allow users to navigate between them by pressing F6 or shift+F6.
    - **Lists**: Add the `a11y__section` class to items in a list to make them keyboard-navigable using the arrow keys.
    - **Modals/Popups**: When not using `WithTooltip`, `GenericModal`, or a similar component, add the `a11y__modal` or `a11y__popup` class to a popup or modal to disable global navigation within it.

### Internationalization (I18n)

- **Translatable Text**: All UI text should be translatable.
- **FormattedMessage vs useIntl**: Prefer the `FormattedMessage` over `useIntl` unless you specifically need a string for a prop.
- **I18n Outside Of React**: When working with translatable text outside of a React component, try to return or store `MessageDescriptor` objects (e.g. `{id: 'test.string', defaultMessage: 'Test String}`). If that's not possible, an `IntlShape` object may be provided.
- **Deprecated APIs**: Don't use `localizeMessage`.
- **Formatting UI Text**: When UI text needs mixed formatting (such as one word bolded), use React Intl's rich text formatting feature instead of Markdown.
- **Combining Translated Text**: When combining multiple translated strings, use React Intl's rich text formatting instead of concatenating or nesting translated strings.

### Testing

- **Testing Framework**: Use React Testing Library (RTL) for all component tests. Don't use Enzyme as it is deprecated and we are working to remove it.
- **Helpers**: Import testing functions from `utils/react_testing_utils` instead of importing them directly from RTL. Use `renderWithContext` for any components that need access to Redux, I18n, or React Router context.
- **Test Philosophy**: Prefer testing how a user would interact with and experience the component rather than testing implementation details. In other words, prefer to interact with the element by simulating user events (e.g. using `userEvent.click` instead of calling methods directly) and testing expected behavior by writing assertions about visible characteristics (e.g. asserting that an element is visible versus checking a component's internal `state`).
    - **No Snapshots**: As an extension of the above, don't use snapshot tests. Instead, be explicit about what is expected to be visible by using `expect(...).toBeVisible(...)` to ensure that others don't unintentionally break the component or its tests in the future.
    - **Testing A11y**: Use RTL to assert that ARIA attributes when necessary (e.g. `expect(...).toHaveAttribute('aria-expanded', 'true')`). See the section above on accessibility for more information.
- **Selectors**: Prefer using accessible RTL selectors to help ensure that components are accessible, roughly in this order: `getByRole` > `getByText`/`getByPlaceholderText` > `getByLabelText`/`getByAltText`/`getByTitle` > `getByTestId`. Usage of `getByTestId` should be rare.
- **User Interactions**: Prefer `userEvent` over `fireEvent` for user interactions, and don't directly call methods on DOM elements to simulate events. RTL's `userEvent` simulates events the most realistically, and it ensures that component changes are properly wrapped in `act`.
    - **Async Interactions**: Always wait for all methods of `userEvent` as those methods are all asynchronous (e.g. `await userEvent.click(...)`).
    - **When fireEvent is acceptable**: Use `fireEvent` only in these specific cases where `userEvent` cannot be used:
        - **Focus/Blur events**: `userEvent` doesn't have direct focus/blur methods. Use `fireEvent.focus()` and `fireEvent.blur()`.
        - **Scroll events**: `userEvent` doesn't support scroll events. Use `fireEvent.scroll()`.
        - **Image loading events**: `userEvent` doesn't support image loading events. Use `fireEvent.load()` and `fireEvent.error()`.
        - **Document-level keyboard events**: `userEvent.keyboard()` requires element focus. Use `fireEvent.keyDown(document, ...)` for global keyboard shortcuts.
        - **Fake timers**: `userEvent` doesn't work well with `jest.useFakeTimers()` and causes timeouts. Use `fireEvent.click()` when tests use fake timers.
        - **Disabled elements**: `userEvent` respects CSS `pointer-events: none` on disabled elements. Use `fireEvent.click()` when testing that disabled element handlers are properly guarded.
        - **MouseMove events**: `userEvent.hover()` only triggers mouseEnter/mouseOver, not mouseMove. Use `fireEvent.mouseMove()` when testing mouseMove handlers specifically.
- **Usage of act**: `act` should only be used when performing any action that causes React to update and when that action does not already go through a helper provided by RTL such as `userEvent`. Typically, most tests can be written without using `act` explicitly.


### Dependencies & Packages

- **React Bootstrap**: Avoid using React Bootstrap directly. Use `GenericModal` from `@mattermost/components` instead of React Bootstrap's `Modal`.
- **MUI**: Consult with the team before using MUI. If it is used, wrap the usage in another component to avoid leaking implementation details.
- **Popovers**: Use `WithTooltip` for simple tooltips and Floating UI for more advanced usage.
- **Icons**: Prefer using icon components from `@mattermost/compass-icons` for icons.

### Redux & Data Fetching

- **Action Results**: Async thunks should always return either an object with a `data` field or an object with an `error` field.
- **Making Requests Using Client4**: `Client4` should only be used directly in Redux actions. When needed, that data should be cached in Redux.
- **Handling Client4 Errors**: Actions which use a method of `Client4` should use `bindClientFunc` if possible for convenience and to follow standard error handling. If they don't, the `Client4` call should be wrapped in a try/catch, and the catch block should contain a `forceLogoutIfNecessary` and dispatch a `logError`.
- **Batching Network Requests**: Batch network requests whenever possible to reduce the number of network requests made. This can be done by either making a bulk request from a parent component containing multiple children or by using an action which uses `DelayedDataLoader`.
- **Selectors**: Selectors that return new objects or arrays (either by a literal or by using a method like `Array.prototype.map`) should be memoized by using `createSelector`.
- **Selector Factories**:
    - When a memoized selector takes arguments, the selector should have a `makeGet...` factory to be memoized per-instance. This isn't necessary when a selector doesn't need to be memoized.
    - When a selector factory is used in a functional component, the instance of the selector factory should be memoized by using `useMemo`. When a selector factory is used in a class component, the instance of the selector factory should be in a `makeMapStateToProps`.
- **makeUseEntity**: Use the `makeUseEntity` helper to create a new hook for lazily fetching entity data from the server
- **Organizing Redux State**: When adding new fields to the Redux state, put data that comes from the server in `mattermost-redux` and in `state.entities`, and put web app state that needs to be persisted outside of `mattermost-redux` and in `state.views`.

### Networking

- **Client4**: All HTTP should use the singleton `Client4` instance, preferably in a Redux action. In cases where it needs to be bypassed, document the reason for that.
- **New Endpoints**: New API endpoints should be added to the `Client4` class in the Client package (`platform/client`).

### Plugin Development

- **APIs**: When exposing components or APIs for plugins, be extra sure it's necessary and limit the number of props to reduce the risk of breakage.
- **Libraries**: Do not add new libraries for plugins to consume.

---

## Standards Still Needing Refinement or Definition

These items are gaps identified in the code analysis. They are areas for active refactoring and cleanup.

- **Styling: !important**: Needs to be eliminated. Over 300 instances remain, primarily in legacy modal overrides.
- **Styling: Hard-Coded Values**: Hard-coded border-radius, box-shadow, and other non-color literals (e.g., 4px) should be replaced with theme variables (e.g., var(--radius-s), var(--elevation-1)).
- **Styling: Responsive Mixins**: Hard-coded @media queries are common and should be migrated to use the shared breakpoint mixins.
- **Styling: Legacy Selectors**: Older SCSS files with element selectors (li, button) or non-BEM class names (PascalCase, camelCase) should be refactored to use modern, scoped BEM patterns when touched.
- **Styling: Units**: We need to settle on a convention of either px, em or rem. **px** is used the most.
- **Navigation Utilities**: Mixed usage of getHistory() from browser_history vs. the useHistory() hook from React Router.
- **Validation & Submission Handling**: Needs Review; validation remains ad-hoc with no shared framework.
- **Virtualized Lists**: Mixed usage; only implemented in a few key areas, with legacy lists still using manual scrolling.
- **useEffect Composition**: Mixed usage; some legacy modules still use single "mega-effects" with internal branching instead of separate effects for separate concerns.
- **Component Prop Typing**: Mixed usage; some legacy files still use any or are untyped.
- **Sanitization & Safe Rendering**: Mixed Usage; potential gaps in unsanitized string interpolation in older components.
- **Local Contexts**: Mixed usage; prop drilling persists in many areas, with contexts only used for a few component families like menus.
- **Handler Placement**: Needs Review; inconsistent naming and placement of event handlers.
- **Direct Downloads & Blob Handling**: Mixed usage of in-component fetch/blob handling vs. legacy server-triggered redirects.
