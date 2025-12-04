# Selectors CLAUDE.md

## Memoization Rules
- **Reselect**: Use `createSelector` from `reselect` for any selector that returns a new object/array derived from state.
- **Simple Selectors**: Simple lookups (e.g., `state => state.id`) do not need memoization.

## Factory Pattern
- **When to use**: If a selector takes arguments (props) and needs to be memoized *per component instance*.
- **Naming**: Prefix with `makeGet...` (e.g., `makeGetChannelMessages`).
- **Implementation**:
  ```typescript
  export function makeGetSomething() {
      return createSelector(
          (state, id) => state.entities[id],
          (entity) => compute(entity)
      );
  }
  ```

## Usage in Components
- **Functional Components**: Wrap factory selectors in `useMemo`.
  ```typescript
  const getSomething = useMemo(makeGetSomething, []);
  const thing = useSelector(state => getSomething(state, props.id));
  ```
- **Class Components**: Instantiate in `makeMapStateToProps`.



