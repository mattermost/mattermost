# @mattermost/eslint-plugin

An ESLint plugin containing the configuration used by Mattermost as well as support for custom rules specific to the Mattermost code base.

## Custom Rules

### no-dispatch-getstate

Prevents passing a [redux](https://redux.js.org/) store's `getState` into its `dispatch` as an unnecessary second argument.

We started doing this accidentally at some point because of a misunderstanding about how [redux-thunk](https://github.com/reduxjs/redux-thunk) worked, so this stops anyone from making that same mistake again.

Examples of **incorrect** code for this rule:
```javascript
export function someAction() {
    return (dispatch, getState) => {
        dispatch(doSomething(), getState);
    };
}
```

Examples of **correct** code for this rule:
```javascript
export function someAction() {
    return (dispatch) => {
        dispatch(doSomething());
    };
}
```

### use-external-link

Ensures that any link which opens a URL outside of Mattermost using `target="_blank"` uses the `ExternalLink` component.

Examples of **incorrect** code for this rule:
```javascript
export function SomeLink() {
    return (
        <a
            href="https://example.com"
            target="_blank"
            rel="noopener noreferrer"
        />
    );
}
```

Examples of **correct** code for this rule:
```javascript
import ExternalLink from 'components/external_link';

export function SomeLink() {
    return <ExternalLink href="https://example.com"/>;
}
```
