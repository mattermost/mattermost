---
title: "Reducers"
heading: "Reducers in Redux at Mattermost"
description: "Reducers in Redux are pure functions that describe how the data in the store changes after any given action."
date: 2017-08-20T11:35:32-04:00
weight: 5
aliases:
  - /contribute/webapp/redux/reducers
---

Reducers in Redux are pure functions that describe how the data in the store changes after any given action. A reducer receives the previous state of the store and an action as a JavaScript object (see [here]({{< ref "/contribute/more-info/webapp/redux/actions" >}}) for more information on actions) and should output the resulting state without receiving any outside data. Because reducers are pure, they will always produce the same resulting state for a given state and action.

```javascript
const myValueDefault = '';
function myValue(state = myValueDefault, action) {
    switch(action.type) {
    case SET_MY_VALUE:
        // This data changes myValue, so just return the new value
        return action.data;

    default:
        // This action doesn't affect us, so return the previous value
        return state;
    }
}
```

Most reducers used by Mattermost Redux are simple like the one above in that they only affect a single part of the store. These can be easily composed using Redux's {{< newtabref href="https://redux.js.org/api-reference/combinereducers" title="`combineReducers`" >}} function to make a more complex data store.

```javascript
function myStringValue(state = '', action) {
    ...
}

function myNumberValue(state = 0, action) {
    ...
}

function myOtherValue(state = {}, action) {
    ...
}

// This combines the reducers so that the resulting store will look like
// {
//     myStringValue: 'abc',
//     myNumberValue: '1234',
//     myOtherValue: {color: 'red', weather: 'rain'}
// }
export const combineReducers({
    myStringValue,
    myNumberValue,
    myOtherValue
});
```

`combineReducers` can be nested further to make up the complex data store as used by Mattermost Redux.

## Avoiding mutating the store

One of the core principals of Redux is that the state of the store should never be modified. If the state changes, a completely new state tree should be returned. That's not to say the entire thing is destroyed and recreated from scratch any time anything changes, but only the parts that are modified are recreated.

For example, if the store holds a state like:

- entities
    - channels
        - channels
    - users
        - currentUserId
        - profiles
- requests
    - getUser
    - getChannel

and we make a request to get the profile for a user that we don't have, the following fields would be changed (shown in bold):

- **entities**
    - channels
        - channels
    - **users**
        - currentUserId
        - **profiles**
- **requests**
    - **getUser**
    - getChannel

To do this, it is important to always return new objects from a reducer if any of its contents change. This is trivial for reducers for state that is a primitive string or number, but it can be more complicated for other types of data. You should also make sure to return the same object if nothing needs to change. As long as you do that, `combineReducers` will make sure to update the rest of the state tree accordingly.

```javascript
function myOtherValue(state = {color: 'red', weather: 'rain'}, action) {
    switch(action.type) {
    case SET_OTHER_VALUE_COLOR:
        // This destructuring syntax is used to create a new object that is a shallow copy of state
        // with the color field updated to the new value
        return {
            ...state,
            color: action.data
        };
    case SET_OTHER_VALUE_WEATHER:
        return {
            ...state,
            weather: action.data
        };

    default:
        // There's no changes, so return the previous value
        return state;
    }
    ...
}
```

If you accidentally mutate the state, you'll receive an error when Mattermost Redux is running in development mode.
