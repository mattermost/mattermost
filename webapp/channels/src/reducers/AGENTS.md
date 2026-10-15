# Redux Toolkit migration (temporary)

> This file is scaffolding for the early Redux Toolkit migration. Delete it once enough slices are migrated that the code itself is the reference for how things are done.

The reference implementation is `reducers/views/threads.ts`. Before migrating anything else, read it along with:

- its test, `reducers/views/threads.test.ts`;
- `reducers/views/rhs.ts` and its test, for an unmigrated reducer that listens for a slice action;
- `selectors/views/threads.ts`, for the selectors that stay outside the slice;
- `actions/views/threads.ts`, for the thunk that stays outside the slice.

## Scope

- Migrate `state.views.*` reducers in `channels/src/reducers/views/`, one per PR.
- Do not migrate `packages/mattermost-redux`. Its `package.json` exports map is public API for plugins.
- Do not migrate `reducers/storage.ts`. It's the only `redux-persist` reducer.
- Do not change store setup in `packages/mattermost-redux/src/store/configureStore.ts`. A slice reducer plugs into the existing `combineReducers` in `reducers/views/index.ts`. RTK's `configureStore` would turn on dev checks that the rest of the store hasn't been audited for.
- Thunks stay as they are for now. Don't introduce `createAsyncThunk` or RTK Query as part of a slice migration.

## First, ask whether the state belongs in Redux

Migrating a reducer that shouldn't exist only makes it look intentional. Before choosing a reducer, check who reads each field:

- If every field is read by one component and nothing else responds to its actions, move it to component state and delete the reducer instead. That's a smaller, better PR than a migration.
- Watch for reset-on-close logic: dispatching to clear state when a modal hides or exits. Component state resets on unmount for free.
- A feature that already moved part of its state to `useState` is a hint the rest can follow.

The textbox preview toggles were the first attempt at a reference slice. They turned out to be component state: each field had one reader, and the slice needed close events and modal timing fixes to behave like `useState`. #39152 deletes the reducer instead.

## Choosing a candidate

Prefer reducers that:

- hold state several distant parts of the app read or write, or that must outlive the components using it;
- respond mostly to their own action types, plus a few owned elsewhere, like `UserTypes.LOGOUT_SUCCESS`;
- are small enough to review in one PR.

Avoid, for now, reducers that:

- store non-serializable values such as callbacks or class instances (`admin.navigationBlock` stores `onNavigationConfirmed`);
- have action creators imported across much of the app (`modals`), since every caller changes;
- are large (`rhs`, `channel_sidebar`).

Before removing an action type constant, search `channels/src`, `packages/mattermost-redux`, and `e2e-tests` for it. Other reducers may listen for it; see "Reducers that listen for slice actions".

## What goes in the slice file

`reducers/views/<name>.ts` contains:

- the exported state type, such as `export type ThreadsViewState`;
- `initialState`;
- `createSlice` named `views/<name>`, with:
  - `reducers` written as Immer mutations;
  - `extraReducers` for actions owned elsewhere;
  - `selectors` for plain reads of the slice's own state;
- named exports of the actions, and of the selectors bound with `slice.getSelectors((state: GlobalState) => state.views.<name>)`;
- the reducer as the default export.

Callers import actions and the plain selectors from `reducers/views/<name>`.

Keep the existing selector names (`getX`, `isX`) so the migration doesn't rename half the codebase. Slice selectors can take extra arguments, as in `isThreadManuallyUnread(state, threadId)`.

### What stays outside

- **Derived and cross-slice selectors** stay in `selectors/views/<name>.ts`: anything memoized with `createSelector`, or that reads other parts of the store. Build them on the slice's selectors rather than reading `state.views.<name>` directly. `makeGetThreadLastViewedAt` uses the slice's `getThreadLastViewedAt`; `isThreadOpen` combines thread, RHS, and team state.
- **Thunks** stay in `actions/views/<name>.ts`. `markThreadAsRead` does.

Delete `actions/views/<name>.ts` or `selectors/views/<name>.ts` only once nothing is left in it.

### Also remove

- the slice's constants in `ActionTypes` (or a dedicated object such as the old `Threads`) in `utils/constants.tsx`;
- the inline type in `types/store/views.ts`, which should import the slice's state type instead.

The slice imports `GlobalState` to bind its selectors, and `types/store/views.ts` imports the slice's state type, so the two import each other. That cycle is expected: both imports are `import type`, so TypeScript resolves it and nothing is left at runtime. Keep both as `import type`. A value import in either direction would make it a real module cycle.

Keep the state shape (`state.views.<name>` and its keys) unless a field is dead. Delete state, actions, and selectors that nothing uses, and call it out in the PR.

## Actions

- Name actions as past-tense events (`threadsViewThreadChanged`, `threadMarkedUnread`), not setters (`setSelectedThreadId`).
- Put the logic in the reducer. A toggle flips state itself, so the caller doesn't read state and dispatch `set(!current)`. A callback prop that hands back `!current` is a toggle, not data.
- One event can update several fields. Replace a `batchActions` of setters with one event: `manuallyMarkThreadAsUnread` batched two actions; `threadMarkedUnread` sets both fields.
- Use `PayloadAction<T>` only when the caller has data the reducer can't derive, such as IDs and timestamps.
- Give payloads with more than one value named fields: `threadMarkedUnread({threadId, lastViewedAt})`, not positional arguments.
- Represent "none" with the `null` the state type allows, never `''` or `undefined`. The old threads code used all three for "no thread selected".
- Name an action after what actually happened, which isn't always a user command. `global_threads.tsx` copies the thread ID from the URL into Redux so non-component code like `isThreadOpen` can read it. That's the Threads view reporting which thread it shows (`threadsViewThreadChanged`, with `null` for none), not the user selecting or deselecting anything. Read the code that dispatches before naming the event.
- When a component gets actions through `connect`, name the prop after the action creator (`threadLastViewedAtChanged`), as with `patchChannel`.
- Bound RTK action creators are typed as plain functions by `packages/mattermost-redux/src/types/extend_redux.d.ts`, so `connect`/`bindActionCreators` callers and their `jest.fn()` mocks keep working.

## Responding to actions owned elsewhere

Handle them in `extraReducers` with `builder.addCase`.

Legacy actions carry their data in fields like `data` rather than `payload`, and `addCase` can't infer that from a string type. Name the shape once and pass it explicitly:

```ts
type PostRemovedAction = {type: typeof PostTypes.POST_REMOVED; data: Post};

builder.addCase<PostRemovedAction['type'], PostRemovedAction>(PostTypes.POST_REMOVED, (state, action) => {
    // action.data is typed
});
```

On logout, reset the whole slice with `addCase(UserTypes.LOGOUT_SUCCESS, () => initialState)`. If the old reducer skipped a field, decide whether that was intentional and say which in the PR. The old `threads.lastUpdateAt` survived logout; the slice now resets it.

## Reducers that listen for slice actions

An unmigrated reducer that responded to the old constant must switch to the slice action's `type` and read `action.payload`:

```ts
case threadsViewThreadChanged.type:
    return action.payload.threadId !== null;
```

Add a test to that reducer's test file dispatching the slice action creator, so a later rename can't silently break it.

## Tests

Follow Redux's [Writing Tests](https://redux.js.org/usage/writing-tests) guidance.

- Reducer tests in `reducers/views/<name>.test.ts`:
  - get the initial state with `reducer(undefined, {type: 'unknown'})`;
  - dispatch the slice's action creators, never hand-written action objects, except for actions owned elsewhere;
  - cover every `extraReducers` case;
  - don't test immutability, since Immer guarantees it.
- Component tests:
  - for new tests, render through `renderWithContext`, which uses a real store, and assert what the user sees after interacting;
  - don't `jest.mock` the slice module or its selectors;
  - when an existing test already mocks `useDispatch`, assert the real action was dispatched: `expect(mockDispatch).toHaveBeenCalledWith(threadMarkedUnread({threadId, lastViewedAt}))`. Slice actions are plain objects, so this compares by value;
  - don't use `redux-mock-store` in new tests.
- Check that a test catches a miswired slice by temporarily breaking a reducer and watching the test fail.

## Verification

Use the Node version in `.nvmrc`; a plain `npm ci` refuses other versions. From `webapp/channels`:

```bash
npm test -- src/reducers/views <affected component and action test paths>
npx tsc -b
npm run check
```

Run tests through `npm test`, not bare `npx jest`: the script sets `TZ=Etc/UTC` and the locale, and date-formatting tests fail without them.

## Removing this file

Delete this file in the PR that migrates the last reducer it would still help with, or sooner once the code is a better guide than these notes. When you do:

- move any rule that still applies into an ESLint rule or a permanent `AGENTS.md`, rather than dropping it;
- say in the PR description that the migration guide was retired.

Until then, update this file in the same PR as any slice migration that changes the pattern, so it never describes code that no longer exists.
