# Phase 4 — Prescriptive Implementation Plan
## CPA display_name: admin edit UX + client-side validator + Phase 3 follow-ups

> Author: Priya (Planning Engineer)
> Date: 2026-04-21
> Branch: cpa-webapp-display-name (base: cpa-display-name @ tip + e542ed4e5e Phase 3 remediation)
> Worktree: ~/.cursor/worktrees/mattermost-server/cpa-webapp-display-name
> Depends on: Phase 3 fully committed and reviewed (commits 97c7a9afe3 + e542ed4e5e)

---

## Research summary

- **TanStack Table (column API):** `user_properties_table.tsx` uses `createColumnHelper<UserPropertyField>()` from `@tanstack/react-table`. Columns are declared as `col.accessor('name', {...})` or `col.display({id, ...})`. The "Display name" column must use `col.accessor('attrs.display_name', {...})` following the exact same pattern — `size`, `header`, `cell`, `enableHiding: false`, `enableSorting: false`. The `EditCell` helper component (lines 393–429) already exists and handles inline editing; it must be reused. [`user_properties_table.tsx:4,107–180`]

- **Validation warning flow:** Warnings are string constants (`ValidationWarningNameRequired`, etc.) set in `user_properties_utils.ts` `beforeUpdate(pending, current)` callback. They are stored in `collection.warnings?.[field.id]?.name` and read in the table cell at lines 129–157 of `user_properties_table.tsx`. A new warning constant `ValidationWarningNameInvalidCEL` follows the same pattern, and the table cell must render the corresponding message. [`user_properties_utils.ts:136–188`, `user_properties_table.tsx:129–157`]

- **Lenient grandfather — server implementation:** `App.PatchCPAField` calls `ValidateCPAFieldName` only when `Name` changes (from Go code comment at line 110). `SanitizeAndValidate` does NOT enforce the CEL rule (asserted by test at line 896). The client `beforeUpdate` must mirror this: skip CEL validation when `field.name === current.data[field.id]?.name` (i.e., no rename). [`custom_profile_attributes.go:99–136`, `custom_profile_attributes_test.go:896–908`]

- **Reserved words are case-sensitive:** Go's `CPAFieldNameReservedWords` is a `map[string]struct{}` with all-lowercase keys. Server tests confirm `"IN"` and `"In"` are NOT reserved. The TypeScript `Set<string>` must be lowercase-only and use `has(name)` — no lowercasing of the input. [`custom_profile_attributes.go:90–97`, `custom_profile_attributes_test.go:989–990`]

- **`getUserPropertyFieldLabel` is already implemented** in `webapp/channels/src/utils/properties.ts` (Phase 3). It returns `attrs?.display_name?.trim() || name`. The delete modal (F1) must import this from that path. [`utils/properties.ts:20–25`]

- **`display_name` is already in the `UserPropertyField` type** as `attrs.display_name?: string` (Phase 3, `webapp/platform/types/src/properties.ts:85`). No type changes needed in Phase 4.

- **i18n pattern:** All keys are in `webapp/channels/src/i18n/en.json`, sorted alphabetically within the `"admin.system_properties.*"` block (lines 3063–3109). New keys must be inserted in lexicographic order within that block.

- **`MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH` discrepancy:** `Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH = 40` (line 1988 of `constants.tsx`) is the HTML `maxLength` passed to the `name` EditCell. The server cap is `PropertyFieldNameMaxRunes = 255`. This is a pre-existing inconsistency. Phase 4 does NOT change the `name` column's `maxLength`; it uses `255` for `display_name`. See OPEN QUESTION 1.

---

## Cross-stack constants (the source of truth)

The following Go constants in `~/.cursor/worktrees/mattermost-server/cpa-display-name/server/public/model/custom_profile_attributes.go` are the ground truth. The TypeScript side must be byte-identical.

### Regex (line 81)
```
^[A-Za-z_][A-Za-z0-9_]*$
```
TypeScript: `/^[A-Za-z_][A-Za-z0-9_]*$/`

### Reserved words (lines 90–97)
```go
"true", "false", "null",
"in", "as",
"break", "const", "continue", "else",
"for", "function", "if", "import",
"let", "loop", "package", "namespace",
"return", "var", "void", "while",
```
Total: **22 words**. All lowercase. Case-sensitive lookup.

### Length cap
`PropertyFieldNameMaxRunes = 255` (from `server/public/model/property_field.go:32`).
`ValidateCPAFieldName` does NOT check length — it is enforced separately by the property field `IsValid()` layer. The TypeScript validator must still enforce 255 runes as an early guard so it matches the server's total rejection behavior.

### Error message IDs (server)
| Error kind | Go error ID |
|-----------|-------------|
| Invalid charset | `model.cpa_field.name.invalid_charset.app_error` |
| Reserved word | `model.cpa_field.name.reserved_word.app_error` |
| Length (display_name) | `app.custom_profile_attributes.sanitize_and_validate.display_name_too_long.app_error` |

The TypeScript validator does not surface Go error IDs — it surfaces its own i18n message IDs (see i18n table below).

---

## Cross-stack drift defense strategy

**Chosen strategy: loud comment block + unit test that hard-codes the expected constants and asserts equality.**

Rationale:
- A code-generation script (option 2) requires new build infrastructure (a Go generator that the webapp CI must invoke). Adds dependency complexity; not implementable without new CI steps.
- A CI grep check (option 3) only detects missing comments, not content drift.
- A unit test (option 1) that imports the TS constants and asserts them against a hard-coded expected value is implementable now, catches drift on every PR, and requires zero new infrastructure. Jest already runs these files.

**Implementation:**
1. Add a comment block at the top of the validator section in `webapp/channels/src/utils/properties.ts`:
```ts
// SOURCE OF TRUTH: server/public/model/custom_profile_attributes.go lines 81–97
// CPAFieldNamePattern and CPAFieldNameReservedWords are Go→TS transcriptions.
// If the Go source changes, update BOTH the regex and the Set below, then update
// the hard-coded assertions in properties.test.ts (TestCPAFieldNameConstants).
// DO NOT change these constants without a corresponding server-side change.
```

2. In `properties.test.ts`, add a `describe('CPA field name constants — cross-stack drift guard')` block that:
   - Asserts the regex string is `'^[A-Za-z_][A-Za-z0-9_]*$'`
   - Asserts the Set contains exactly 22 words matching the Go slice (parameterized)
   - If either assertion fails, the error message says "Update the TS constant to match the Go source at server/public/model/custom_profile_attributes.go"

---

## Files to Modify (exhaustive)

| Task | File | Action | Key lines | Notes |
|------|------|--------|-----------|-------|
| 4.1 | `webapp/channels/src/components/admin_console/system_properties/user_properties_table.tsx` | Modify | 108–255 (columns array) | Add display_name column; rename "Attribute" header; add CEL identifier hint |
| 4.2 | `webapp/channels/src/utils/properties.ts` | Modify | After line 25 | Add CPA_FIELD_NAME_PATTERN, CPA_FIELD_NAME_RESERVED_WORDS, validateCPAFieldName |
| 4.2 | `webapp/channels/src/utils/properties.test.ts` | Modify | End of file | Add drift-guard block + validateCPAFieldName test matrix |
| 4.3 | `webapp/channels/src/components/admin_console/system_properties/user_properties_utils.ts` | Modify | 144–178 (beforeUpdate warnings reducer) | Add ValidationWarningNameInvalidCEL; wire validateCPAFieldName with grandfather rule |
| 4.3 | `webapp/channels/src/components/admin_console/system_properties/user_properties_table.tsx` | Modify | 129–157 (name column cell) | Render new CEL warning; update column header i18n |
| 4.4 | `webapp/channels/src/components/admin_console/system_properties/user_properties_table.test.tsx` | Modify | End of describe block | New test cases for display_name column, CEL validation, grandfather |
| 4.4 | `webapp/channels/src/components/admin_console/system_properties/user_properties_utils.test.ts` | Modify | End of describe block | New test cases for CEL validation warning in beforeUpdate |
| F1 | `webapp/channels/src/components/admin_console/system_properties/user_properties_delete_modal.tsx` | Modify | Line 34 | field.name → getUserPropertyFieldLabel(field) |
| F1 | `webapp/channels/src/components/admin_console/system_properties/user_properties_delete_modal.test.tsx` | Modify | Lines 89–103 (hook test) | Update assertion: name prop should equal display_name, not raw identifier |
| F2 | `webapp/channels/src/components/admin_console/system_properties/user_properties_dot_menu.tsx` | Modify | Lines 123–129 (handleDuplicate) | Slug-transform the name; use CEL-safe suffix |
| F2 | `webapp/channels/src/utils/properties.ts` | Modify | After validateCPAFieldName | Add slugifyForCEL helper |
| F2 | `webapp/channels/src/components/admin_console/system_properties/user_properties_utils.ts` | Modify | Lines 276–285 (getIncrementedName) | Add getIncrementedCELName with `_2`, `_3` collision suffix |
| F2 | `webapp/channels/src/components/admin_console/system_properties/user_properties_dot_menu.test.tsx` | Modify | Lines 180–198 (duplicate test) | Update expected name to reflect slug + CEL-safe collision suffix |
| i18n | `webapp/channels/src/i18n/en.json` | Modify | Lines 3063–3109 block | Insert new keys (alphabetical order) |

Total files: **9 source files + 1 i18n file = 10 files**.

---

## Task 4.1 — Display name column

**File:** `webapp/channels/src/components/admin_console/system_properties/user_properties_table.tsx`

### Step 1: Rename the `name` column header

At lines 112–125, replace the `ColHeaderLeft` content:
```tsx
// BEFORE (line 120–124):
<FormattedMessage
    id='admin.system_properties.user_properties.table.property'
    defaultMessage='Attribute'
/>

// AFTER:
<ColHeaderLeft>
    <FormattedMessage
        id='admin.system_properties.user_properties.table.identifier'
        defaultMessage='Identifier'
    />
    <IdentifierHint>
        <FormattedMessage
            id='admin.system_properties.user_properties.table.identifier.hint'
            defaultMessage='CEL identifier used in policies'
        />
    </IdentifierHint>
</ColHeaderLeft>
```

Add `IdentifierHint` styled component below `ColHeaderRight` (around line 344):
```tsx
const IdentifierHint = styled.div`
    font-size: 11px;
    color: rgba(var(--center-channel-color-rgb), 0.56);
    margin-top: 2px;
`;
```

### Step 2: Add the Display name column

Insert a new `col.accessor` entry AFTER the `name` column definition (after line 180) and BEFORE the `type` column (line 181):

```tsx
col.accessor((row) => row.attrs?.display_name ?? '', {
    id: 'display_name',
    size: 200,
    header: () => (
        <ColHeaderLeft>
            <FormattedMessage
                id='admin.system_properties.user_properties.table.display_name'
                defaultMessage='Display name'
            />
        </ColHeaderLeft>
    ),
    cell: ({getValue, row}) => {
        const toDelete = row.original.delete_at !== 0;
        const isProtected = Boolean(row.original.attrs?.protected);
        return (
            <EditCell
                value={getValue() as string}
                label={formatMessage({
                    id: 'admin.system_properties.user_properties.table.display_name.input.label',
                    defaultMessage: 'Display Name',
                })}
                testid='property-display-name-input'
                deleted={toDelete}
                disabled={isProtected}
                maxLength={255}
                setValue={(value: string) => {
                    updateField({
                        ...row.original,
                        attrs: {
                            ...row.original.attrs,
                            display_name: value.trim() || undefined,
                        },
                    });
                }}
            />
        );
    },
    enableHiding: false,
    enableSorting: false,
}),
```

**Key notes:**
- Use `col.accessor((row) => row.attrs?.display_name ?? '', {id: 'display_name', ...})` (function accessor with explicit `id`) because `attrs.display_name` is an optional nested key — TanStack Table's string accessor `'attrs.display_name'` requires dot-notation support that may not be configured. Use the function form for safety.
- `setValue` must spread `row.original.attrs` first, then override `display_name`, to avoid wiping other attrs.
- `value.trim() || undefined` converts empty string to `undefined` so the field serializes with `omitempty`-compatible semantics (matches server side which trims display_name).
- `maxLength={255}` matches `PropertyFieldNameMaxRunes`. Do NOT use `Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH` (40) — that constant applies only to `name` (and is a pre-existing inconsistency noted in OPEN QUESTION 1).

### Step 3: Update the `updateField` call on the name column

The existing call at line 170:
```tsx
setValue={(value: string) => {
    updateField({...row.original, name: value.trim()});
}}
```
This is correct as-is. No change needed — the `name` column updates only `name`, the display_name column updates only `attrs.display_name`.

### Step 4: Remove or update the TODO comment

Remove the `// TODO(cpa-display-name Phase 4 task 4.1)` comment block at lines 113–116 — that's this task being completed.

---

## Task 4.2 — Client-side validator

**File:** `webapp/channels/src/utils/properties.ts`

Insert after the `getUserPropertyFieldLabel` function (after line 25):

```ts
// SOURCE OF TRUTH: server/public/model/custom_profile_attributes.go lines 81–97
// CPAFieldNamePattern and CPAFieldNameReservedWords are Go→TS transcriptions.
// If the Go source changes, update BOTH the regex and the Set below, then update
// the hard-coded assertions in properties.test.ts (describe 'CPA field name constants').
// DO NOT change these constants without a corresponding server-side change.

/**
 * Mirrors server CPAFieldNamePattern (^[A-Za-z_][A-Za-z0-9_]*$).
 * Source: server/public/model/custom_profile_attributes.go:81
 */
export const CPA_FIELD_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Mirrors server CPAFieldNameReservedWords.
 * Source: server/public/model/custom_profile_attributes.go:90–97
 * 22 CEL keywords. Case-sensitive: only lowercase forms are reserved.
 */
export const CPA_FIELD_NAME_RESERVED_WORDS = new Set<string>([
    'true', 'false', 'null',
    'in', 'as',
    'break', 'const', 'continue', 'else',
    'for', 'function', 'if', 'import',
    'let', 'loop', 'package', 'namespace',
    'return', 'var', 'void', 'while',
]);

/** Max runes for a CPA field name. Mirrors server PropertyFieldNameMaxRunes. */
export const CPA_FIELD_NAME_MAX_RUNES = 255;

export type CPAFieldNameValidationError =
    | {kind: 'invalid_charset'}
    | {kind: 'reserved_word'; word: string}
    | {kind: 'too_long'; max: number};

/**
 * Client-side mirror of server ValidateCPAFieldName.
 * Returns null when the name is valid; returns an error descriptor otherwise.
 *
 * Length is checked here (against CPA_FIELD_NAME_MAX_RUNES = 255) even though
 * the server's ValidateCPAFieldName does not — this provides an early guard
 * matching the server's total rejection behavior.
 *
 * Lenient grandfather: callers must only invoke this when field.name has
 * CHANGED from its server-persisted value (mirrors App.PatchCPAField behavior).
 */
export function validateCPAFieldName(name: string): CPAFieldNameValidationError | null {
    if ([...name].length > CPA_FIELD_NAME_MAX_RUNES) {
        return {kind: 'too_long', max: CPA_FIELD_NAME_MAX_RUNES};
    }
    if (!CPA_FIELD_NAME_PATTERN.test(name)) {
        return {kind: 'invalid_charset'};
    }
    if (CPA_FIELD_NAME_RESERVED_WORDS.has(name)) {
        return {kind: 'reserved_word', word: name};
    }
    return null;
}

/**
 * Converts an arbitrary string into a CEL-safe identifier for use as
 * a duplicate-field base name. Non-identifier characters are replaced
 * with underscores. A leading digit is prefixed with underscore.
 * Result is guaranteed to match CPA_FIELD_NAME_PATTERN if the input
 * is non-empty; returns '_copy' if the entire input normalizes to empty.
 */
export function slugifyForCEL(name: string): string {
    let slug = name.replace(/[^A-Za-z0-9_]/g, '_');
    if (/^[0-9]/.test(slug)) {
        slug = '_' + slug;
    }
    // collapse multiple underscores; strip trailing underscores
    slug = slug.replace(/_+/g, '_').replace(/_+$/, '');
    return slug || '_copy';
}
```

**Notes:**
- `[...name].length` uses the spread operator to count Unicode codepoints (rune-equivalent), matching Go's `utf8.RuneCountInString`.
- The validator returns a typed discriminated union, not a string, so callers can map to appropriate i18n keys.
- `slugifyForCEL` is placed in the same file so it can be tested alongside the validator.

---

## Task 4.3 — Wire validator into the form

### Step 1: Add validation warning constant and import

**File:** `webapp/channels/src/components/admin_console/system_properties/user_properties_utils.ts`

At line 271, after the existing export constants:
```ts
export const ValidationWarningNameInvalidCEL = 'user_properties.validation.name_invalid_cel';
```

At the top of the file, add the import:
```ts
import {validateCPAFieldName} from 'utils/properties';
```

### Step 2: Wire the validator in `beforeUpdate`

**File:** `webapp/channels/src/components/admin_console/system_properties/user_properties_utils.ts`

In the `beforeUpdate(pending, current)` function (lines 136–188), in the `Object.values(pending.data).reduce(...)` callback, after the existing `if (!field.name)` check and before the `pendingByName` uniqueness check, insert:

```ts
// Lenient grandfather: only validate CEL name when name has changed.
// Mirrors server App.PatchCPAField behavior: ValidateCPAFieldName is only
// called when the Name field changes (newly created fields always validate).
const originalName = current.data[field.id]?.name;
const nameChanged = field.create_at === 0 || field.name !== originalName;
if (nameChanged && field.name) {
    const celError = validateCPAFieldName(field.name);
    if (celError) {
        acc[field.id] = {name: ValidationWarningNameInvalidCEL};
        return acc;
    }
}
```

**Placement:** This check goes AFTER the `if (!field.name)` empty-name guard and BEFORE the `pendingByName[...]` uniqueness check. The `return acc` after setting the CEL warning prevents overwriting with a subsequent uniqueness error — CEL invalidity takes priority.

**Grandfather logic:**
- `field.create_at === 0` → newly created (always validate, no server-persisted name to compare)
- `field.name !== originalName` → name has been changed by the admin
- If `current.data[field.id]` is undefined (field was just created) → `originalName` is undefined, so `field.name !== undefined` is true → validate. This is correct because a brand-new field must have a valid name.

### Step 3: Render the CEL warning in the table cell

**File:** `webapp/channels/src/components/admin_console/system_properties/user_properties_table.tsx`

Import `ValidationWarningNameInvalidCEL`:
```ts
import {isCreatePending, useUserPropertyFields, ValidationWarningNameRequired, ValidationWarningNameTaken, ValidationWarningNameUnique, ValidationWarningNameInvalidCEL} from './user_properties_utils';
```

In the `name` column cell (lines 129–157), add a new `else if` branch after the `ValidationWarningNameTaken` branch:
```tsx
} else if (warningId === ValidationWarningNameInvalidCEL) {
    warning = (
        <FormattedMessage
            tagName={DangerText}
            id='admin.system_properties.user_properties.table.validation.name_invalid_cel'
            defaultMessage='Identifier must start with a letter or underscore and contain only letters, numbers, and underscores. Reserved CEL words are not allowed.'
        />
    );
}
```

### Step 4: Block save on CEL warning

The `useUserPropertiesTable` hook at line 84:
```ts
isValid: !userPropertyFields.warnings,
```
This already blocks the save button when ANY warning exists. No additional change needed — `ValidationWarningNameInvalidCEL` will be stored in `userPropertyFields.warnings` by `beforeUpdate`, and the save will be blocked automatically.

### Step 5: Import the validator in the table file

The import of `getUserPropertyFieldLabel` (needed for F1) goes in:
```ts
import {getUserPropertyFieldLabel} from 'utils/properties';
```
Add to the imports in `user_properties_table.tsx` if not already present (Phase 3 may have added it).

---

## Task 4.4 — Exhaustive tests

### 4.4a — Validator unit tests (`properties.test.ts`)

**File:** `webapp/channels/src/utils/properties.test.ts`

```ts
describe('CPA field name constants — cross-stack drift guard', () => {
    it('CPA_FIELD_NAME_PATTERN string matches the Go source exactly', () => {
        // If this fails, update to match server/public/model/custom_profile_attributes.go:81
        expect(CPA_FIELD_NAME_PATTERN.source).toBe('^[A-Za-z_][A-Za-z0-9_]*$');
    });

    it('CPA_FIELD_NAME_RESERVED_WORDS contains exactly 22 words matching the Go source', () => {
        const expected = new Set([
            'true', 'false', 'null',
            'in', 'as',
            'break', 'const', 'continue', 'else',
            'for', 'function', 'if', 'import',
            'let', 'loop', 'package', 'namespace',
            'return', 'var', 'void', 'while',
        ]);
        expect(CPA_FIELD_NAME_RESERVED_WORDS.size).toBe(22);
        for (const word of expected) {
            expect(CPA_FIELD_NAME_RESERVED_WORDS.has(word)).toBe(true);
        }
        for (const word of CPA_FIELD_NAME_RESERVED_WORDS) {
            expect(expected.has(word)).toBe(true);
        }
    });
});

describe('validateCPAFieldName', () => {
    // Happy paths — must return null
    const validCases = [
        ['simple lowercase', 'department'],
        ['leading underscore', '_private'],
        ['uppercase start', 'Department'],
        ['single uppercase', 'A1'],
        ['underscore separator', 'a_b_c'],
        ['all uppercase', 'DEPT'],
        ['case-sensitive: IN is not reserved', 'IN'],
        ['case-sensitive: In is not reserved', 'In'],
        ['single lowercase letter', 'a'],
        ['single underscore', '_'],
        ['single uppercase letter', 'A'],
        ['reserved word as prefix', 'trueish'],
        ['reserved word as suffix', 'my_null'],
        ['255-rune name at exactly max length', 'a'.repeat(255)],
    ];

    test.each(validCases)('%s: %s → null', (_label, input) => {
        expect(validateCPAFieldName(input)).toBeNull();
    });

    // Invalid charset — must return {kind: 'invalid_charset'}
    const invalidCharsetCases = [
        ['space in name', 'My Field'],
        ['leading digit', '7department'],
        ['hyphen', 'foo-bar'],
        ['emoji', '🎯'],
        ['empty string', ''],
        ['trailing space', 'name '],
        ['non-ASCII letter', 'départment'],
        ['whitespace only', '   '],
        ['dot separator', 'foo.bar'],
        ['slash', 'foo/bar'],
    ];

    test.each(invalidCharsetCases)('%s: %s → invalid_charset', (_label, input) => {
        expect(validateCPAFieldName(input)).toEqual({kind: 'invalid_charset'});
    });

    // Reserved words — must return {kind: 'reserved_word'}
    const reservedWords = [
        'true', 'false', 'null',
        'in', 'as',
        'break', 'const', 'continue', 'else',
        'for', 'function', 'if', 'import',
        'let', 'loop', 'package', 'namespace',
        'return', 'var', 'void', 'while',
    ];

    test.each(reservedWords)('reserved word: %s → reserved_word', (word) => {
        expect(validateCPAFieldName(word)).toEqual({kind: 'reserved_word', word});
    });

    // Length boundary
    it('254-rune name → null', () => {
        expect(validateCPAFieldName('a'.repeat(254))).toBeNull();
    });

    it('255-rune name → null (exactly at cap)', () => {
        expect(validateCPAFieldName('a'.repeat(255))).toBeNull();
    });

    it('256-rune name → too_long', () => {
        expect(validateCPAFieldName('a'.repeat(256))).toEqual({kind: 'too_long', max: 255});
    });
});

describe('slugifyForCEL', () => {
    it('already valid identifier passes through unchanged', () => {
        expect(slugifyForCEL('dept_head')).toBe('dept_head');
    });

    it('spaces are replaced with underscores', () => {
        expect(slugifyForCEL('My Field')).toBe('My_Field');
    });

    it('hyphens are replaced with underscores', () => {
        expect(slugifyForCEL('foo-bar')).toBe('foo_bar');
    });

    it('leading digit gets underscore prefix', () => {
        expect(slugifyForCEL('7department')).toBe('_7department');
    });

    it('empty string returns _copy', () => {
        expect(slugifyForCEL('')).toBe('_copy');
    });

    it('all-punctuation string returns _copy', () => {
        expect(slugifyForCEL('---')).toBe('_copy');
    });

    it('result always matches CPA_FIELD_NAME_PATTERN', () => {
        const inputs = ['My Field', 'foo-bar', '7dept', '', '---', 'valid_name', 'DEPT'];
        for (const input of inputs) {
            const result = slugifyForCEL(input);
            expect(CPA_FIELD_NAME_PATTERN.test(result)).toBe(true);
        }
    });
});
```

### 4.4b — `beforeUpdate` validation tests (`user_properties_utils.test.ts`)

Add to the existing `describe('useUserPropertyFields')` block:

```ts
it('should flag CEL invalid name on new field', async () => {
    // ... (setup same as other tests)
    act(() => {
        const [,,, ops] = result.current;
        ops.update({...fields.data[field0.id], name: 'My Field'});
    });
    rerender();
    const [fields] = result.current;
    expect(fields.warnings).toEqual(expect.objectContaining({
        [field0.id]: {name: ValidationWarningNameInvalidCEL},
    }));
});

it('should flag reserved word name', async () => {
    // ...
    act(() => {
        const [,,, ops] = result.current;
        ops.update({...fields.data[field0.id], name: 'in'});
    });
    rerender();
    const [fields] = result.current;
    expect(fields.warnings).toEqual(expect.objectContaining({
        [field0.id]: {name: ValidationWarningNameInvalidCEL},
    }));
});

it('should NOT flag CEL error when name is unchanged (grandfather)', async () => {
    // field0 has an invalid name seeded from the server (simulating legacy)
    const legacyField = {...field0, name: 'My Legacy Field'};
    getFields.mockResolvedValueOnce([legacyField, field1, field2, field3]);
    // ... (setup with legacyField)
    // Update only display_name, not name
    act(() => {
        const [,,, ops] = result.current;
        ops.update({...fields.data[legacyField.id], attrs: {...legacyField.attrs, display_name: 'My Legacy Label'}});
    });
    rerender();
    const [fields] = result.current;
    // No CEL warning because name didn't change
    expect(fields.warnings?.[legacyField.id]?.name).not.toBe(ValidationWarningNameInvalidCEL);
});

it('should flag CEL error when renaming a legacy invalid-named field to another invalid name', async () => {
    const legacyField = {...field0, name: 'My Legacy Field'};
    // ...
    act(() => {
        const [,,, ops] = result.current;
        ops.update({...fields.data[legacyField.id], name: '7invalid'});
    });
    rerender();
    const [fields] = result.current;
    expect(fields.warnings).toEqual(expect.objectContaining({
        [legacyField.id]: {name: ValidationWarningNameInvalidCEL},
    }));
});

it('should accept a valid rename of a legacy invalid-named field', async () => {
    const legacyField = {...field0, name: 'My Legacy Field'};
    // ...
    act(() => {
        const [,,, ops] = result.current;
        ops.update({...fields.data[legacyField.id], name: 'my_legacy_field'});
    });
    rerender();
    const [fields] = result.current;
    expect(fields.warnings?.[legacyField.id]?.name).not.toBe(ValidationWarningNameInvalidCEL);
});
```

### 4.4c — Component tests (`user_properties_table.test.tsx`)

Add to the existing `describe('UserPropertiesTable')` block:

```ts
it('renders Display name column header', () => {
    renderComponent();
    expect(screen.getByText('Display name')).toBeInTheDocument();
});

it('renders Identifier column header (renamed from Attribute)', () => {
    renderComponent();
    expect(screen.getByText('Identifier')).toBeInTheDocument();
    expect(screen.queryByText('Attribute')).not.toBeInTheDocument();
});

it('shows display_name value in the Display name column', () => {
    const fields = baseFields.map((f, i) => ({
        ...f,
        attrs: {...f.attrs, display_name: `Display ${i + 1}`},
    }));
    renderComponent(fields);
    expect(screen.getByDisplayValue('Display 1')).toBeInTheDocument();
});

it('falls back to empty string when display_name is undefined', () => {
    renderComponent(); // baseFields have no display_name
    const displayNameInputs = screen.getAllByTestId('property-display-name-input');
    expect(displayNameInputs[0]).toHaveValue('');
});

it('calls updateField with updated display_name on blur', async () => {
    renderComponent();
    const displayNameInput = screen.getAllByTestId('property-display-name-input')[0];
    await userEvent.clear(displayNameInput);
    await userEvent.type(displayNameInput, 'Department Head');
    fireEvent.blur(displayNameInput);
    expect(updateField).toHaveBeenCalledWith(expect.objectContaining({
        attrs: expect.objectContaining({display_name: 'Department Head'}),
    }));
});

it('shows CEL validation error for invalid identifier (space)', async () => {
    const fields = [...baseFields];
    const collection = collectionFromArray(fields);
    collection.warnings = {field1: {name: ValidationWarningNameInvalidCEL}};
    renderWithContext(<UserPropertiesTable data={collection} canCreate={true} {...mockActions}/>);
    await waitFor(() => {
        expect(screen.getByText(/Identifier must start with a letter or underscore/)).toBeInTheDocument();
    });
});

it('shows CEL validation error for reserved word', async () => {
    const collection = collectionFromArray(baseFields);
    collection.warnings = {field1: {name: ValidationWarningNameInvalidCEL}};
    renderWithContext(<UserPropertiesTable data={collection} canCreate={true} {...mockActions}/>);
    await waitFor(() => {
        expect(screen.getByText(/Reserved CEL words are not allowed/)).toBeInTheDocument();
    });
});

it('editing display_name of a legacy invalid-named field does not fire CEL warning', async () => {
    // Grandfather test: name unchanged, only display_name edited
    const legacyField = {
        ...baseFields[0],
        name: 'My Legacy Field', // invalid CEL, but not changed
        attrs: {...baseFields[0].attrs},
    };
    const collection = collectionFromArray([legacyField]);
    // No warnings set — grandfather: name not changed
    renderWithContext(<UserPropertiesTable data={collection} canCreate={true} {...mockActions}/>);
    const displayNameInput = screen.getByTestId('property-display-name-input');
    await userEvent.type(displayNameInput, 'Legacy Display');
    fireEvent.blur(displayNameInput);
    // updateField called with display_name changed but no CEL warning rendered
    expect(screen.queryByText(/Identifier must start with a letter/)).not.toBeInTheDocument();
});

it('editing identifier of a legacy field triggers CEL validation', async () => {
    const legacyField = {...baseFields[0], name: 'My Legacy Field'};
    const collection = collectionFromArray([legacyField]);
    collection.warnings = {[legacyField.id]: {name: ValidationWarningNameInvalidCEL}};
    renderWithContext(<UserPropertiesTable data={collection} canCreate={true} {...mockActions}/>);
    await waitFor(() => {
        expect(screen.getByText(/Identifier must start with a letter or underscore/)).toBeInTheDocument();
    });
});
```

---

## Phase 3 inherited follow-ups

### F1: Delete modal display_name

**File:** `webapp/channels/src/components/admin_console/system_properties/user_properties_delete_modal.tsx`

**Problem:** `promptDelete` at line 34 passes `field.name` (raw CEL identifier) as the `name` prop to `RemoveUserPropertyFieldModal`. After Phase 3, the human-facing label is `getUserPropertyFieldLabel(field)`. The modal title reads "Delete `department` attribute" when it should read "Delete Department attribute".

**Before (line 34):**
```ts
name: field.name,
```

**After:**
```ts
name: getUserPropertyFieldLabel(field),
```

**Import to add** at the top of the file (after existing imports):
```ts
import {getUserPropertyFieldLabel} from 'utils/properties';
```

**Verify modal still renders correctly:** The `RemoveUserPropertyFieldModal` component uses `{name}` in the `title` and the `DeleteText` body — these stay as-is since they receive the label string, not the raw identifier.

**Test update** (`user_properties_delete_modal.test.tsx`, lines 89–103):

```ts
// BEFORE (line 98):
dialogProps: {
    name: baseField.name,
    ...
}

// AFTER:
dialogProps: {
    name: getUserPropertyFieldLabel(baseField), // = baseField.name since no display_name set
    ...
}
```

Also add a test case for a field WITH `display_name`:
```ts
it('passes display_name as the modal name when set', () => {
    const {result} = renderHookWithContext(() => useUserPropertyFieldDelete());
    const fieldWithDisplayName = {
        ...baseField,
        name: 'department',
        attrs: {...baseField.attrs, display_name: 'Department Head'},
    };
    result.current.promptDelete(fieldWithDisplayName);
    expect(openModal).toHaveBeenCalledWith(expect.objectContaining({
        dialogProps: expect.objectContaining({
            name: 'Department Head',
        }),
    }));
});
```

---

### F2: Duplicate flow CEL-safe identifier

**Problem:** `handleDuplicate` in `user_properties_dot_menu.tsx` at lines 123–129 produces `"{fieldName} (copy)"` — contains spaces, fails CEL validation. The existing `getIncrementedName` collision handler appends `" 2"`, `" 3"` etc., which are also invalid.

**Decision: auto-slug the identifier.** Rationale:
- Lower friction for the admin — no extra click or modal required.
- The admin can always rename the duplicate via inline edit of the Identifier column.
- Auto-slugging is deterministic and auditable.
- Rejected "open inline edit" approach because it requires a new interaction pattern (a modal or an activation flow) and Phase 4's scope is already bounded.

**Step 1: Add `getIncrementedCELName` to `user_properties_utils.ts`**

After `getIncrementedName` (lines 276–285), add:
```ts
/**
 * Like getIncrementedName but produces CEL-safe collision suffixes (_2, _3 …)
 * instead of space-separated numerals (which fail the CEL identifier pattern).
 * Use this for any context where the name must be a valid CEL identifier.
 */
const getIncrementedCELName = (desiredName: string, collection: UserPropertyFields): string => {
    const names = new Set(Object.values(collection.data).map(({name}) => name));
    let newName = desiredName;
    let n = 1;
    while (names.has(newName)) {
        n++;
        newName = `${desiredName}_${n}`;
    }
    return newName;
};
```

**Step 2: Update `handleDuplicate` in `user_properties_dot_menu.tsx`**

**Before (lines 123–129):**
```ts
const handleDuplicate = () => {
    const name = formatMessage({
        id: 'admin.system_properties.user_properties.dotmenu.duplicate.name_copy',
        defaultMessage: '{fieldName} (copy)',
    }, {fieldName: field.name});
    createField({...field, attrs: {...field.attrs}, name});
};
```

**After:**
```ts
const handleDuplicate = () => {
    // Produce a CEL-safe base name: slug the original identifier and append _copy.
    // The createField call routes through itemOps.create which calls getIncrementedCELName
    // to handle collisions. The admin can rename the duplicate via inline edit.
    const baseName = slugifyForCEL(field.name) + '_copy';
    createField({...field, attrs: {...field.attrs}, name: baseName});
};
```

**Import to add** in `user_properties_dot_menu.tsx`:
```ts
import {slugifyForCEL} from 'utils/properties';
```

**Step 3: Update `itemOps.create` to use `getIncrementedCELName`**

In `user_properties_utils.ts`, the `create` op at lines 213–229:
```ts
create: (patch?) => {
    pendingIO.apply((pending) => {
        const nextOrder = ...
        const field = newPendingField({
            type: 'text',
            ...patch,
            name: getIncrementedName(patch?.name ?? 'Text', pending), // ← change this
            ...
        });
        ...
    });
},
```

The collision suffix logic must be CEL-safe when a CEL-valid name is provided as the patch:
```ts
// Use CEL-safe collision suffix when the name base is already a valid identifier.
// Fall back to the original getIncrementedName for 'Text' (valid) and other non-slug bases.
name: validateCPAFieldName(patch?.name ?? 'Text') === null
    ? getIncrementedCELName(patch?.name ?? 'Text', pending)
    : getIncrementedName(patch?.name ?? 'Text', pending),
```

Actually, simpler: always use `getIncrementedCELName` for the `create` op — the default base `'Text'` is already CEL-valid, so `'Text_2'` is also valid. This keeps the logic clean.

```ts
name: getIncrementedCELName(patch?.name ?? 'Text', pending),
```

**Update the i18n key:** The old key `admin.system_properties.user_properties.dotmenu.duplicate.name_copy` with `defaultMessage: '{fieldName} (copy)'` is no longer used in the dot menu. Remove its usage. Keep the key in `en.json` for now (removing i18n keys requires a separate deprecation pass); simply stop formatting it.

**Step 4: Update dot menu test** (`user_properties_dot_menu.test.tsx`, lines 180–198)

**Before:**
```ts
expect(createField).toHaveBeenCalledWith(expect.objectContaining({
    id: baseField.id,
    name: 'Test Field (copy)',
}));
```

**After:**
```ts
expect(createField).toHaveBeenCalledWith(expect.objectContaining({
    id: baseField.id,
    name: 'Test_Field_copy', // slugifyForCEL('Test Field') + '_copy'
}));
```

Add a collision test:
```ts
it('duplicate produces _2 suffix when base name is already taken', async () => {
    // Seed a field named 'Test_Field_copy' so the first attempt collides
    const existingCopy = {...baseField, id: 'copy-id', name: 'Test_Field_copy'};
    renderComponent(baseField, {}, [baseField, existingCopy]);
    // ... open menu, click duplicate
    await waitFor(() => {
        expect(createField).toHaveBeenCalledWith(expect.objectContaining({
            name: 'Test_Field_copy_2',
        }));
    });
});
```

---

## i18n keys to add

All insertions go into `webapp/channels/src/i18n/en.json` within the `"admin.system_properties.*"` block. Keys must be in **alphabetical order** relative to neighbors.

| Key | English default | Insert after |
|-----|----------------|--------------|
| `admin.system_properties.user_properties.table.display_name` | `Display name` | `...table.actions` |
| `admin.system_properties.user_properties.table.display_name.input.label` | `Display Name` | `...table.display_name` |
| `admin.system_properties.user_properties.table.identifier` | `Identifier` | `...table.filter_type` |
| `admin.system_properties.user_properties.table.identifier.hint` | `CEL identifier used in policies` | `...table.identifier` |
| `admin.system_properties.user_properties.table.validation.name_invalid_cel` | `Identifier must start with a letter or underscore and contain only letters, numbers, and underscores. Reserved CEL words are not allowed.` | `...table.validation.name_taken` |

**Note:** The existing key `admin.system_properties.user_properties.table.property` (defaultMessage `'Attribute'`) becomes dead code once the column header switches to `table.identifier`. Leave it in `en.json` for now — removing i18n keys is a separate cleanup pass; removing prematurely breaks locale files.

---

## Concurrency / HA notes

Phase 4 introduces no new shared state, async races, or distributed coordination. The admin CPA table is a single-admin editing surface. All validation (lenient grandfather, CEL check, uniqueness) is applied in the `beforeUpdate` synchronous callback before any API call is made. The commit flow is sequential (`delete → edit → create`). No locking, optimistic concurrency, or conflict resolution is needed.

---

## Risks and mitigations

- **Risk: Table renders `name` when `display_name` column is also present — could be confusing if they're identical.**
  - **Mitigation:** After Phase 3's backfill migration, every field has `display_name` equal to `name` for legacy fields. The table will show two identical values in those rows. This is intentional: the admin should update `display_name` to a human-friendly label. Add placeholder text in the `display_name` input (via `BorderlessInput`'s `placeholder` prop) indicating "Same as identifier if empty" to reduce confusion. This is not strictly required but greatly improves UX.

- **Risk: The `name` column's `maxLength={40}` (Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH) is inconsistent with the server cap of 255. An admin who pastes a 41-rune name will be silently truncated by the HTML input before the validator runs.**
  - See **OPEN QUESTION 1** below.

- **Risk: `getIncrementedName` used in `itemOps.create` with default base `'Text'` currently produces `'Text 2'`, `'Text 3'` — invalid CEL identifiers.** After Task F2 Step 3 (switching to `getIncrementedCELName`), the default base becomes `'Text_2'`, `'Text_3'` — valid CEL. This is a side effect of F2 that improves baseline behavior.

- **Risk: `display_name` column's `setValue` calls `updateField` with `attrs.display_name: undefined` when the admin clears the input.** This is intentional: an empty display_name falls back to `name` via `getUserPropertyFieldLabel`. However, the server patches `attrs` as a full replacement (not a merge — as noted in the Go test at `custom_profile_attributes_test.go:1508-1509`). The `user_properties_utils.ts` commit patch builder at line 88-89 already sends the full `attrs` object, so `undefined` for `display_name` will serialize as absent, which is correct for the `omitempty` case.
  - **Mitigation:** The `setValue` in Task 4.1 Step 2 sets `display_name: value.trim() || undefined` — `undefined` is correct; but confirm the patch builder in `user_properties_utils.ts` lines 88-97 serializes `undefined` attrs values as absent (not as `"null"`). If it does not, change to `display_name: value.trim() || ''` and rely on the server's `strings.TrimSpace` to normalize.

- **Risk: React keys in the table use `row.original.id` (via TanStack Table's `getRowId` default). After adding `display_name`, keys remain stable because they're derived from `id`, not `name` or `display_name`.**
  - **Confirmed safe:** TanStack Table uses `index` by default if `getRowId` is not set; the `userProperties` meta table at lines 265–272 does not set `getRowId`. Rows are re-keyed on sort changes but not on name changes. Display_name changes do not affect key stability.

- **Risk: Reserved-word list drift over time (cel-go upgrades, new CEL keywords).**
  - **Mitigation:** The drift-guard unit test (Task 4.2) hard-codes 22 words and asserts exact equality. Any PR that adds a word to the Go source without updating TS will fail the assertion.

- **Risk: Duplicate flow — `slugifyForCEL(field.name) + '_copy'` may collide with an existing field.**
  - **Mitigation:** `getIncrementedCELName` handles collisions by appending `_2`, `_3`, etc. This is applied in `itemOps.create`. The collision check is against `pending.data` (includes both server-persisted and currently-pending fields), so in-session duplicates-of-duplicates are also handled.

---

## Definition of Done

The implementer ticks each item before opening the commit:

- [ ] Task 4.1: "Display name" column visible in the CPA admin table; values editable inline; `updateField` correctly spreads `attrs`; header renamed to "Identifier" with hint text.
- [ ] Task 4.2: `CPA_FIELD_NAME_PATTERN`, `CPA_FIELD_NAME_RESERVED_WORDS`, `CPA_FIELD_NAME_MAX_RUNES`, `validateCPAFieldName`, `slugifyForCEL` exported from `utils/properties.ts`. Regex source and reserved-word set match the Go source exactly.
- [ ] Task 4.3: `ValidationWarningNameInvalidCEL` constant exported from `user_properties_utils.ts`; `beforeUpdate` applies the validator with grandfather rule; table cell renders the CEL error message; save is blocked when warnings exist.
- [ ] Task 4.4: All test cases in §4.4a, §4.4b, §4.4c pass. No new test skips or `any` casts introduced.
- [ ] F1: `user_properties_delete_modal.tsx` line 34 uses `getUserPropertyFieldLabel(field)` not `field.name`. Test updated to assert display_name is passed to the modal.
- [ ] F2: `handleDuplicate` produces a slug-based name + `_copy` suffix; `getIncrementedCELName` used for collision handling; dot menu test updated to match new expected name.
- [ ] i18n: 5 new keys inserted in alphabetical order in `en.json`. No existing keys removed.
- [ ] No TypeScript errors: `cd webapp && npm run check-types`.
- [ ] No lint errors: `cd webapp && npm run lint`.
- [ ] All existing tests still pass: `cd webapp/channels && npm test`.
- [ ] OPEN QUESTION 1 is resolved (see below) before merge.

---

## Out of scope (deferred)

- Removing deprecated i18n key `admin.system_properties.user_properties.dotmenu.duplicate.name_copy` — separate cleanup PR.
- Removing `admin.system_properties.user_properties.table.property` key — same cleanup PR.
- Raising `MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH` from 40 to 255 for the `name` column HTML input — see OPEN QUESTION 1.
- Fixing `getIncrementedName`'s space-suffix behavior for contexts OTHER than the duplicate flow and the `create` op (e.g., if it's called elsewhere) — out of scope, not called in other paths.
- Adding a placeholder/hint text inside the Display name input cell — nice-to-have UX, not required.
- Phase 5 (Live E2E + Playwright regression spec) — separate task per PLAN-webapp.md.
- Plugin-API bypass validation gap (PR #36173 scope).
- Bulk import/export CPA fields — no such code path on master (confirmed by spike).

---

## OPEN QUESTIONS

**OPEN QUESTION 1 (RESOLVED 2026-04-21 by Lead — Option B):** Keep the `name` EditCell at `maxLength={Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH}` = 40 for Phase 4.

Rationale: `MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH` is a SHARED constant that may be referenced by non-CPA call sites; changing it would have unwanted blast radius. Raising the cap independently is a UX-only change (no spec or data correctness driver) and is best handled as a separate, well-scoped cleanup with its own product review. Legacy fields with names 41–255 chars created via plugin API will remain renameable via the dot menu / direct API call but not via the inline edit cell — accepted as a documented edge case (mention in the row hover tooltip if cheap). Phase 4 does NOT touch `Constants.MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH` and does NOT change the `name` EditCell's `maxLength` attribute.

For the new `display_name` EditCell, use `maxLength={255}` directly (or define a CPA-local constant `CPA_DISPLAY_NAME_MAX_LENGTH = 255` co-located with the validator in `utils/properties.ts` if there is more than one site using it). Do NOT introduce a new shared `Constants.*` entry.

---

## LEAD ADDENDUM (2026-04-21)

The following two items are added to Phase 4 scope by the Lead based on Priya's "single biggest risk" callout. They are NOT optional.

### LA1 — Mandatory test: rename clears grandfather

Add to `user_properties_table.test.tsx` (Task 4.4c) a new test case named `'rename of legacy field clears grandfather: subsequent edits to the now-valid name trigger validation'`. The test must:

1. Seed the table with a legacy field whose `name` is invalid (e.g., `dept head` with a space — pre-Phase-1 grandfathered).
2. Rename it to a valid identifier (e.g., `dept_head`) and save successfully — confirm `current` is refreshed via `readIO.setData`.
3. Attempt a subsequent rename to another invalid identifier (e.g., `42dept` — leading digit). The form-level validator MUST reject this attempt (no longer protected by lenient grandfather, because step 2 brought the field's `name` into the validated regime).

This test pins the staleness contract on the `current` snapshot and prevents a future refactor from inadvertently extending grandfather protection past the first successful rename.

### LA2 — Visible note in `utils/properties.ts` on grandfather staleness

Add a comment block above the validator export documenting the grandfather contract and pointing to LA1's test as the regression guard:

```ts
// Grandfather contract:
// CPA name validation only fires when `name` changes from its initial server-persisted value.
// After a successful rename, `current.data[field.id].name` is refreshed by the table's
// readIO.setData(newData) call, which moves the field into the strictly-validated regime
// for all subsequent edits. The regression guard for this contract is in
// user_properties_table.test.tsx — search for 'rename of legacy field clears grandfather'.
```

---

## Implementation summary

- Commit SHA: `736b73fe82f7584183bb637e68573688c8f7cb10`
- Diff stat: `11 files changed, 676 insertions(+), 43 deletions(-)`
- Tests run:
  - `cd webapp/channels && npm test -- --runInBand src/utils/properties.test.ts src/components/admin_console/system_properties/user_properties_utils.test.ts src/components/admin_console/system_properties/user_properties_table.test.tsx src/components/admin_console/system_properties/user_properties_delete_modal.test.tsx src/components/admin_console/system_properties/user_properties_dot_menu.test.tsx` - passed
  - `cd webapp && npm run check-types` - passed
  - `cd webapp/channels && npm run check` - passed
- Typecheck: `npm run check-types` passed from `webapp`
- Lint: `webapp` has no root `lint` script in this worktree; `webapp/channels npm run check` (eslint + stylelint) passed as the authoritative lint target for the changed Phase 4 files
- Deviations:
  - The plan says the reserved-word set contains 22 entries, but the server source at `server/public/model/custom_profile_attributes.go` currently contains 21. The TypeScript constant and drift-guard test were implemented to match the server source exactly.
  - This summary was appended in a follow-up docs-only commit because the implementation commit SHA had to exist before it could be recorded in the plan file.
- Reviewer notes:
  - Kept the `name` input capped at 40 and left shared `MAX_CUSTOM_ATTRIBUTE_NAME_LENGTH` unchanged, per the lead resolution.
  - Added the mandatory rename-clears-grandfather regression coverage and the grandfather-contract comment in `utils/properties.ts`.
