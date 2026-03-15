---
title: "Redux Testing"
heading: "Redux Unit and E2E Testing"
description: "How to unit and E2E test with mattermost-redux."
weight: 7
aliases:
  - /contribute/webapp/redux/testing
---

### Unit Testing

#### Unit Testing for Actions

Tests for both actions and action creators are written using {{< newtabref href="https://jestjs.io/" title="Jest" >}} and will often focus on seeing how dispatching an action affects the stored state in Redux. It'll often look similar to testing a reducer except you'll be looking at the whole store state instead of a single part of it.

There are a few different ways of testing Redux actions used throughout Mattermost, but the most common way involves:

1. Setting up an initial store state for the test case.
2. Optionally mocking any external operations that may be required for the action. This includes API requests which are mocked using {{< newtabref href="https://github.com/nock/nock" title="Nock" >}}.
3. Dispatching the result of the action creator.
4. Looking at the resulting store state to ensure the required changes are made.

    ```typescript
    import nock from 'nock';

    import mockStore from 'tests/test_store';

    import {somethingAsyncHappened, somethingHappened} from './actions';

    describe('somethingHappened', () => {
        const channelId = 'channelId';

        test('should update state.somethingCount', () => {
            const store = mockStore({
                somethingCount: 0,
            });

            // Remember to actually call your action creator since that's very easy to forget to do
            store.dispatch(somethingHappened(channelId));

            expect(store.getState().somethingCount).toBe(1234);
        });
    });

    describe('somethingAsyncHappened', () => {
        // Initial state may be shared between multiple test cases and may include state that's required for both
        // testing and for thunk actions
        const currentUserId = 'currentUserId';
        const initialState = {
            entities: {
                users: {
                    currentUserId: 'user1',
                },
            },
            somethingCount: 0,
        };

        test('should update state.somethingCount on success', async () => {
            const store = mockStore(initialState);

            const expectedResult = {status: 'SomethingHappened'};
            nock(Client4.getBaseRoute()).
                post(`/channels/${channelId}/something`).
                reply(200, {});

            // Remember that tests for async requests need to themselves be async and we need to wait for the dispatch
            await store.dispatch(somethingAsyncHappened(channelId));

            expect(store.getState().somethingCount).toBe(1234);
        });

        test('should update state.somethingCount on failure', async () => {
            const store = mockStore(initialState);

            const expectedResult = {status: 'SomethingHappened'};
            nock(Client4.getBaseRoute()).
                post(`/channels/${channelId}/something`).
                reply(400, {});

            // You can also inspect the result of the action if desired
            const result = await store.dispatch(somethingAsyncHappened(channelId));

            expect(result.error).toBeDefined();
            expect(result.data).not.toBeDefined();

            expect(store.getState().somethingCount).toBe(0);
        });
    });
    ```
5. Add unit tests to make sure that the action has the intended effects on the store. Test location is adjacent to the file being tested. Example, for `src/actions/admin.js`, test is located at `src/actions/admin.test.js`.  Add test file if necessary. More information on unit testing reducers is available below.

Some unit tests found throughout the web app may also test the actions dispatched by a thunk action rather than testing the effects on the changes to the store state. This method isn't considered as effective.

#### Unit Testing for Selectors

Unit tests for selectors are located in the same directory, adjacent to the file being tested. For example, the test for `src/selectors/admin.js` is located at `src/selectors/admin.test.js`. These tests are written using {{< newtabref href="https://jestjs.io/" title="Jest Testing Framework" >}}. In that folder, there are many examples of how those tests should look. Most follow the same general pattern of:
1. Construct the initial test state. Note that this doesn't need to be shared between tests as it is in many other cases.
2. Pass the state into the selector and check the results. The tests for some more complicated selectors do this multiple times while changing different parts of the store to ensure that the memoization is working correctly since it can be very important in certain areas of the app.

### End-to-End (E2E) Testing

#### E2E Tests for Actions

Sometimes, it's not easy to test a redux action given it contains complicated async logic or requires a large amount of Redux state to be initialized to test it out. Other times, an action may feel too simple to test, especially if it's just dispatching an action that dictates specifically how the Redux state should change.

In cases where the action will have an effect that's visible to the end user, it's possible to rely more on [end-to-end testing]({{<relref "contribute/more-info/webapp/e2e-testing.md">}}). While this might not test every code path of the action such as poor network conditions, end-to-end tests are often more valuble since they involve testing that the code as a whole does what is expected rather than testing just that a single piece of code works under artificial conditions which may not be realistic.