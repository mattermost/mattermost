# CLAUDE: `selectors/`

## Rules
- **Purpose**: Derive/compute state. Avoid duplication.
- **Location**: Generic -> `selectors/`. View-specific -> `selectors/views/`.
- **Dependencies**: Depend on State or other Selectors. NO imports from Reducers/Store.

## Memoization (Reselect)
- **Constraint**: MUST use `createSelector` if returning new Objects/Arrays.
- **Pattern**:
  ```typescript
  export const getVisibleItems = createSelector(
      'getVisibleItems',
      (state) => state.entities.items,
      (items) => Object.values(items).filter(i => i.visible)
  );
  ```

## Factory Pattern
- **Constraint**: Use `makeGet...` for per-instance memoization (selectors with props).
- **Pattern**:
  ```typescript
  export function makeGetItem() {
      return createSelector(
          'getItem',
          (state, id) => state.entities.items,
          (state, id) => id,
          (items, id) => items[id]
      );
  }
  ```
- **Usage**: `const getItem = useMemo(makeGetItem, []);` inside component.
