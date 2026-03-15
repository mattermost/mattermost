---
title: "Actions"
heading: "Redux actions"
description: "An explanation of Redux actions and how they're used in Mattermost."
date: 2017-08-20T11:35:32-04:00
weight: 4
aliases:
  - /contribute/webapp/redux/actions
---

In Redux, actions represent an operation either performed by the user or the server that cause a change to the state of the web app which is stored in the Redux store. It's generally represented as a plain JavaScript object with a constant `type` string with other data stored in fields such as `data`.

```typescript
{
    type: 'SELECT_CHANNEL',
    data: channelId,
}
```

Actions are created by functions called action creators. In regular Redux, this function will take some arguments and return an action representing how the store should be changed. Something to note with Mattermost Redux is that we typically refer to the action creators as the "actions" themselves since there's often a single action creator for a given type of action.

```typescript
function selectChannel(channelId: string) {
    return {
        type: 'SELECT_CHANNEL',
        data: channelId,
    };
}
```

This action is later received by the Redux store's reducers which will know how to read the contents of the action and modify the store accordingly.

Because we use the {{< newtabref href="https://github.com/reduxjs/redux-thunk" title="Thunk middleware" >}} for Redux, we have the ability to use more powerful action creators that can read the state of the store, perform asynchronous actions like network requests, and dispatch multiple actions when needed. Instead of returning a plain object, these action creators return a function that takes the Redux store's `dispatch` and `getState` to be able to dispatch actions as needed.

```typescript
function loadAndSelectChannel(channelId: string) {
    return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
        const {channels} = getState().entities.channels;

        if (!channels.hasOwnProperty(channelId)) {
            // Optionally call another action to asynchronously load the channel over the network
            dispatch(setChannelLoading(true));

            await dispatch(loadChannel(channelId));

            dispatch(setChannelLoading(false));
        }

        // Switch to the channel
        dispatch(selectChannel(channelId));
    };
}
```

Actions live in the `src/actions` directory with the constants that define their types being in the `src/action_types` directory.

## Use actions

To use an action, you need to pass it into the `dispatch` method of the Redux store so that it can be passed off to the reducers.

```typescript
const store = createReduxStore();

store.dispatch(loadAndSelectChannel(channelId));
```

Typically, you won't have direct access to the store to get its `dispatch` method. Instead, you'll receive it from either {{< newtabref href="https://react-redux.js.org/" title="React Redux" >}} or {{< newtabref href="https://github.com/reduxjs/redux-thunk" title="Redux Thunk" >}} depending on what part of the code you're working on.

### Dispatch actions from a component

{{< newtabref href="https://react-redux.js.org/" title="React Redux" >}} provides two ways of accessing dispatch, and you'll see both used throughout Mattermost.

The first is by its `connect` higher order component. Its second parameter `mapDispatchToProps` is used to wrap action creators so that they will automatically be dispatched when called.

```tsx
// src/components/widget/index.jsx

import {connect} from 'react-redux';

import {loadAndSelectChannel} from 'src/actions/channels';

import Widget from './widget';

// mapDispatchToProps is an object containing all actions passed into the component
const mapDispatchToProps = {
    loadAndSelectChannel,
};

export default connect(null, mapDispatchToProps)(Widget);

// src/components/widget/widget.tsx

type Props = {
    channelId: string;

    // Notice that the type of the wrapped action omits the `getState` and `dispatch` parameters of the Thunk action
    loadAndSelectChannel: (channelId: string) => void;
}

export default function Widget(props: Props) {
    const handleClick = useCallback(() => {
        // We don't need to dispatch anything at this point
        props.loadAndSelectChannel(props.channelId);
    }, [props.loadAndSelectChannel, props.channelId]);

    return (
        <button onClick={handleClick}>
            {'Click me!'}
        </button>
    );
}
```

Alternatively, you can use the `useDispatch` hook to dispatch actions directly in the component.

```tsx
// src/components/widget/widget.tsx

import {useDispatch} from 'react-redux';

import {loadAndSelectChannel} from 'src/actions/channels';

type Props = {
    channelId: string;
}

export default function Widget(props: Props) {
    const dispatch = useDispatch();

    const handleClick = useCallback(() => {
        dispatch(loadAndSelectChannel(props.channelId));
    }, [dispatch, props.channelId]);

    return (
        <button onClick={handleClick}>
            {'Click me!'}
        </button>
    );
}
```

The choice of which method to use is left up to the developer at the moment. `connect` is more widely used throughout the code base, but that's primarily because hooks are relatively new compared to it. The class-based components that make up older parts of the app also aren't compatible with hooks.

When deciding which one to use though, try to match the area of the code that you're working in. Individual components should never mix the two.

## Add an action

The steps for adding a new Redux action are as follows:

1. Decide where to the action creator will be located. Depending on where the action will be located you will want to put it in one of the following locations:
    - If the action is more general and affects Redux state stored in `state.entities`, it should be put somewhere in `webapp/channels/src/packages/mattermost-redux/src/actions`.
    - If the action is specific to the web app, affects `state.views` and will be used in multiple places throughout the app, it should be put in `actions`.
    - If the action is very specific and will likely only be used by one or more closely related components, it should be put in an `actions.ts` located in the same directory as those components.

2. If the action creator will have an effect on the Redux state that isn't covered by existing action types, you'll need to add a new "action type" constant that will be used by the action creator and will be handled by a reducer. These are located separate from the definition of the action creator itself to avoid having reducers import code from the action creators directly.

    Depending on where the action is located, the action creator will be located in one of the following:
    - If the action is located in `mattermost-redux`, the action type should be added to one of the files in `webapp/channels/src/packages/mattermost-redux/src/action_types`.
    - If the action is specific to the web app or a single component, the action type should be added to the `ActionTypes` object in `webapp/channels/src/utils/constants.tsx`.

    ```typescript
    export default keyMirror({
        SOMETHING_HAPPENED: null
    });
    ```

3. Write the action creator itself. Depending on what data is needed by the action and if it needs to perform any async operations will change whether or not a Thunk action should be used. We should generally try to use plain Redux actions wherever possible since they're a bit more complex, both to read and to process.

    ```typescript
    function somethingHappened(channelId: string) {
        return {
            type: SOMETHING_HAPPENED,
            channelId,
            data: 1234,
        };
    }

    function somethingAsyncHappened(channelId: string) {
        return async (dispatch: DispatchFunc, getState: GetStateFunc) => {
            const currentUserId = getCurrentUserId(getState());

            let data;
            try {
                data = await Client4.doSomething(currentUserId, channelId);
            } catch (error) {
                dispatch({
                    type: SOMETHING_FAILED,
                    channelId,
                    error,
                });

                return {error};
            }

            // Note that if you need to access state again after waiting for something asynchronous, you should call
            // getState a second time to ensure you have an up to date version of the state

            dispatch({
                type: SOMETHING_HAPPENED,
                channelId,
                data,
            });
        };
    }
    ```

4. If you added a new action type, make sure to add or update existing reducers to handle the new action. More information about reducers is available [here]({{< ref "/contribute/more-info/webapp/redux/reducers" >}}).
5. Add unit tests to make sure that the action has the intended effects on the store. More information on unit testing reducers is available on the page [Redux Unit and E2E Testing]({{<relref "/contribute/more-info/webapp/redux/testing.md">}}).

### Add a new API action

If your action is corresponds to an API call, there are a few extra steps required but also a helper function to simplify the error handling for the action. The additional steps are as follows:

1. Ensure that `Client4`, the JavaScript API client for Mattermost which is located in `webapp/platform/client/src/client4.ts`, has a method that corresponds to the API endpoint that you're using. That method will likely involve simply constructing the URL for the endpoint, optionally constructing a body for the request, and then using the `doFetch` method to actually make the request.

    ```typescript
    class Client4 {
        doSomething = (userId: string, channelId: string) => {
            return this.doFetch<SomethingResponse>(
                `${this.getUserRoute(userId)}/something`,
                {method: 'post', body: JSON.stringify({channelId})},
            );
        }
    }
    ```

2. Depending on your use case, you'll likely want to dispatch a Redux action containing the response to the API request when it succeeds. You may optionally also want to dispatch actions when the request is made or fails to update the Redux state as the request progresses.
    ```typescript
    export default keyMirror({
        SOMETHING_HAPPENED: null,

        // The following actions are optional. They used to be added for every API request, but we found we were only
        // rarely using their results, so we don't recommend adding them any more
        SOMETHING_REQUEST: null,
        SOMETHING_SUCCESS: null,
        SOMETHING_FAILURE: null,
    });
    ```
3. Most actions involving an API request follow a similar pattern of calling Client4 with the provided parameters, handling any errors that may occur, and dispatching an action containing the result if successful. The `bindClientFunc` helper can help with that.

    ```typescript
    function somethingAsyncHappened(channelId: string) {
        return bindClientFunc({
            clientFunc: client.doSomething,

            onSuccess: SOMETHING_HAPPENED,
            params: [channelId],
        };
    }

    // clientFunc is the only mandatory parameter of bindClientFunc. The rest may be added as needed.
    function somethingVerboseHappened(userId: string, channelId: string) {
        return bindClientFunc({
            clientFunc: client.doSomething,

            // The onRequest action will be dispatched before the request is made
            onRequest: SOMETHING_REQUEST,

            // The onSuccess action will be dispatched if the request succeeds. It will include a data parameter
            // containing the response to the request. Additionally, onSuccess can be an array of actions if multiple
            // should be dispatched when the request succeeds.
            onSuccess: [SOMETHING_SUCCESS, SOMETHING_HAPPENED],

            // The onFailure action will be dispatched if the request fails due to a network issue or an invalid request.
            // It will include an error parameter containing an Error object.
            onFailure: SOMETHING_FAILED,

            // An array of parameters will be passed into clientFunc in the order they're received
            params: [userId, channelId],
        };
    }
    ```
