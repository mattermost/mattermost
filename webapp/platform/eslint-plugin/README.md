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

### no-redundant-admin-config-deps

Enforces that System Console settings in `admin_definition` files do not repeat `isDisabled` config/state checks already implied by a parent setting they depend on.

When setting B disables itself with `it.stateIsFalse('A')`, A is a bool setting, and A already includes condition C (for example `it.configIsTrue('ClusterSettings', 'Enable')`), repeating C on B is redundant and tends to drift. Keep the dependency on A and omit the duplicated checks. Inheritance only follows bool parents (disabled bools are forced false on save). Permission and license helpers are not treated as config dependencies.

The rule builds the full bool-parent dependency tree before reporting. If a setting lists both a parent and a grandparent, redundant conditions are attributed to the closest (most specific) parent — not whichever ancestor appears first in `isDisabled`.

Examples of **incorrect** code for this rule:
```javascript
{
    type: 'bool',
    key: 'EmailSettings.EnableEmailBatching',
    isDisabled: it.any(
        it.stateIsFalse('EmailSettings.SendEmailNotifications'),
        it.configIsTrue('ClusterSettings', 'Enable'),
    ),
},
{
    type: 'number',
    key: 'EmailSettings.EmailBatchingBufferSize',
    isDisabled: it.any(
        it.stateIsFalse('EmailSettings.SendEmailNotifications'),
        it.stateIsFalse('EmailSettings.EnableEmailBatching'),
        it.configIsTrue('ClusterSettings', 'Enable'),
    ),
},
```

Examples of **correct** code for this rule:
```javascript
{
    type: 'bool',
    key: 'EmailSettings.EnableEmailBatching',
    isDisabled: it.any(
        it.stateIsFalse('EmailSettings.SendEmailNotifications'),
        it.configIsTrue('ClusterSettings', 'Enable'),
    ),
},
{
    type: 'number',
    key: 'EmailSettings.EmailBatchingBufferSize',
    isDisabled: it.any(
        it.stateIsFalse('EmailSettings.EnableEmailBatching'),
    ),
},
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
