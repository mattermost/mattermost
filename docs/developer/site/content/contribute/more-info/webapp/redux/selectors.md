---
title: "Selectors"
heading: "How to use selectors - Mattermost"
description: "Find out what selectors are, and how to use and add them in Mattermost."
date: 2017-08-20T11:35:32-04:00
weight: 6
aliases:
  - /contribute/webapp/redux/selectors
---

Selectors are functions used to compute data from the data in the Redux stores. This is done using {{< newtabref href="https://github.com/reactjs/reselect" title="Reselect" >}}, a library designed to do this efficiently by memoizing any results so that they are only recalculated if relevant parts of the store change. The code for this is in the `src/selectors` folder of the Mattermost Redux repository.

For more information about reselect and how we use it at Mattermost, {{< newtabref href="https://www.youtube.com/watch?v=6N2X7gEwmaQ" title="check out this developer talk given by core developer Harrison Healey" >}}.

## Use a selector

Selectors are simple functions that take the state from the redux store and return some data computed from them. Most selectors take simply the state of the redux store and return some data from the store.

```javascript
const currentUser = getCurrentUser(state);
const currentTeam = getCurrentTeam(state);
```

Selectors can also receive additional arguments however extra care must be taken to ensure that the extra argument doesn't prevent proper memoization. Instead of providing the selector directly, a factory function will usually be provided so that each location or component that users the selector can be memoized separately.

```javascript
const getPostsInThread = makeGetPostsInThread();

const selectedPost = getSelectedPost(state);
const postsInSelectedThread = getPostsInThread(state, selectedPost.root_id);
```

For an example of how a selector like `makeGetPostInThread` could be used with React, see [here]({{< ref "/contribute/more-info/webapp/redux/react-redux" >}}).

## Add a selector

The most basic selector is just a function that takes in the state and returns a part of it without any memoization or complicated logic. All these provide is that they make it easier to access part of the store without having to remember exactly where the data is.

```javascript
export function getCurrentUserId(state) {
    return state.entities.users.currentUserId;
}
```

To create a selector that actually computes some data, you need to use Reselect's {{< newtabref href="https://github.com/reactjs/reselect#createselectorinputselectors--inputselectors-resultfunc" title="`createSelector`" >}} to combine simple selectors like the one above and provide some proper memoziation.

```javascript
export const getCurrentUser = createSelector(
    getCurrentUserId,
    (state) => state.entities.users.profiles,
    (currentUserId, profiles) => {
        if (!profiles.hasOwnProperty(currentUserId)) {
            // Current user not found
            return {};
        }

        return profiles[currentUserId];
    }
);
```

The way that `createSelector` works is that it takes any number of "input selectors" followed by a single "result function". When you call the selector, it calls all of the input selectors to get the values that will be passed into the result function. If any of those have changed, it passes them to the result function to calculate and return the final result. If none of those values change, it skips the result function, and just returns the previous value.

By keeping the input selectors simple and memoizing based on their results, we can skip recalculating the final value which saves time and keeps it so that `getCurrentUser(state) === getCurrentUser(state)` even when `getCurrentUser` returns an object that can't normally be compared with `===`. This is incredibly important when using Redux with React as your selectors will likely be called many times per second so minimizing time taken and returning new objects sparingly can have significant performance gains.

While Reselect doesn't encourage the use of selectors with parameters, these can be passed in when calling the selector. Any arguments passed in will be provided to the input selectors, but not the result function. If necessary, you can work around this by including an extra input selector to pass the argument along.

```javascript
export function makeGetUser() {
    return createSelector(
        getProfiles,
        (state, userId) => userId,
        (profiles, userId) => {
            if (!profiles.hasOwnProperty(userId)) {
                // User not found
                return {};
            }

            return profiles[userId];
        }
    );
}
```

Note that when we make a selector that takes arguments, we typically wrap it in a factory function so that we can create multiple instances of the selector that are each memoized separately. This is because having a single instance of the above `getUser` selector and calling it with different user IDs would prevent any memoization since it would be constantly called with different IDs leading it to recalculate on each call.

This may sound unnecessary if you're writing a one-off selector, but if you think of something like a `getPost` selector in the Mattermost app, we will frequently be rendering 100+ post components each with their own copy of the `getPost` selector. With only a single copy of that selector, it would be constantly recalculating, but with 100+ copies, each only recalculates and rerenders when their specific post changes.
