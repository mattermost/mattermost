# Redux Toolkit migration (temporary)

> This file is scaffolding for the early Redux Toolkit migration. Delete it once enough slices are migrated that the code itself is the reference for how things are done.

The reference implementation is `reducers/views/textbox.ts`. Read it, its test, and the preview toggle test in `components/channel_settings_modal/channel_settings_info_tab.test.tsx` before migrating anything else.

## Scope

- Migrate `state.views.*` reducers in `channels/src/reducers/views/`, one per PR.
- Do not migrate `packages/mattermost-redux`. Its `package.json` exports map is public API for plugins.
- Do not migrate `reducers/storage.ts`. It's the only `redux-persist` reducer.
- Do not change store setup in `packages/mattermost-redux/src/store/configureStore.ts`. A slice reducer plugs into the existing `combineReducers` in `reducers/views/index.ts`. RTK's `configureStore` would turn on dev checks that the rest of the store hasn't been audited for.
- Thunks stay as they are for now. Don't introduce `createAsyncThunk` or RTK Query as part of a slice migration.

## Choosing a candidate

Prefer reducers that:

- hold UI state local to one feature;
- respond only to their own action types, plus generic ones like `UserTypes.LOGOUT_SUCCESS`;
- have action types that nothing else listens for. Search `channels/src`, `packages/mattermost-redux`, and `e2e-tests` for each `ActionTypes.X` before removing it.

## One file per slice

`reducers/views/<name>.ts` is the only Redux file for the slice. It contains:

- the exported state type, such as `export type TextboxState`;
- `initialState`;
- `createSlice` named `views/<name>`, with:
  - `reducers` written as Immer mutations;
  - `extraReducers` for actions owned elsewhere, such as resetting on logout;
  - `selectors` written against the slice state;
- named exports of the actions, and of the selectors bound with `slice.getSelectors((state: GlobalState) => state.views.<name>)`;
- the reducer as the default export.

Then delete what the slice replaces:

- `actions/views/<name>.ts`
- `selectors/views/<name>.ts`
- the slice's constants in `ActionTypes` in `utils/constants.tsx`
- the inline type in `types/store/views.ts`, which should import the slice's state type instead

Callers import actions and selectors from `reducers/views/<name>`.

Keep the state shape (`state.views.<name>` and its keys) unless a field is dead. Delete state, actions, and selectors that nothing uses, and call it out in the PR.

## Actions

- Name actions as past-tense events (`channelSettingsModalClosed`, `channelSettingsPurposePreviewToggled`), not setters.
- Put the logic in the reducer. A toggle flips state itself, so the caller doesn't read state and dispatch `set(!current)`.
- One event can update several fields. Don't make callers dispatch several setters.
- Use `PayloadAction<T>` only when the caller has data the reducer can't derive.
- Bound RTK action creators are typed as plain functions by `packages/mattermost-redux/src/types/extend_redux.d.ts`, so `connect`/`bindActionCreators` callers and their `jest.fn()` mocks need no changes.

## Tests

Follow Redux's [Writing Tests](https://redux.js.org/usage/writing-tests) guidance.

- Reducer tests in `reducers/views/<name>.test.ts`:
  - get the initial state with `reducer(undefined, {type: 'unknown'})`;
  - dispatch the slice's action creators, never hand-written action objects;
  - don't test immutability, since Immer guarantees it.
- Component tests:
  - render through `renderWithContext`, which uses a real store;
  - assert what the user sees after interacting;
  - don't `jest.mock` the slice module or its selectors;
  - don't use `redux-mock-store` in new tests.
- Check that a test catches a miswired slice by temporarily breaking a reducer and watching the test fail.

## Verification

From `webapp/channels`:

```bash
npx jest src/reducers/views/<name>.test.ts <affected component dirs>
npx tsc -b
npm run check
```
