// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlTestResult, AccessControlVisualAST} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {CHANNEL_ATTRIBUTES_OBJECT_TYPE, SESSION_ATTRIBUTES_OBJECT_TYPE, isSessionAttributeField} from '@mattermost/types/properties_user';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {CPA_FIELD_NAME_PATTERN} from 'utils/properties';

import AttributeSelectorMenu from './attribute_selector_menu';
import OperatorSelectorMenu from './operator_selector_menu';
import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

import CELHelpModal from '../../modals/cel_help/cel_help_modal';
import {AddAttributeButton, TestButton, TestResults, HelpText, OPERATOR_CONFIG, OPERATOR_LABELS, OperatorLabel, isMultiValueOperator, isMultiselectOperator, isGraphOperator, isRankOperator, isNativeMethodOperator, operatorSupportsChannelTarget, celPathFor, isNativeField, isNativeBooleanField, allowedOperatorLabelsForField, defaultOperatorForField, isValidYoungerThanDaysValue, RESOURCE_ATTRIBUTES_PREFIX, VISUAL_AST_ATTRIBUTE_VALUE_TYPE, SESSION_ATTRIBUTE_CEL_PREFIX, USER_ATTRIBUTE_CEL_PREFIX} from '../shared';

import './table_editor.scss';

export function celStringLiteral(val: string): string {
    return '"' + val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

export function rowToCEL(row: TableRow): string {
    const isNative = row.isNative === true;
    const isSession = row.attribute_object_type === SESSION_ATTRIBUTES_OBJECT_TYPE;

    // Session attributes live under `user.session.<name>`; native attributes
    // under `user.<name>`; everything else is a custom profile attribute at
    // `user.attributes.<name>`.
    const attributeExpr = isSession ? `${SESSION_ATTRIBUTE_CEL_PREFIX}${row.attribute}` : celPathFor(row.attribute, isNative);

    // A fully-masked row has no visible values on the client side.  Emit a
    // placeholder "in []" expression so the backend merge can locate this
    // condition by attribute and re-inject the hidden values before persisting.
    // Without this guard the condition would be filtered out by updateExpression,
    // the empty expression would be sent to the server, and buildCELFromConditions
    // would return "true" — making the policy wide-open (security regression).
    if (row.hasMaskedValues && row.values.length === 0 && !row.targetAttribute) {
        return `${attributeExpr} in []`;
    }

    // A graph hierarchy predicate is a member call on the user's graph attribute
    // whose one argument is either a list of option names or the accessed
    // channel's graph attribute. Neither shape fits OPERATOR_CONFIG, so the
    // predicate is recognized from the operator alone, before config is read.
    // Exact membership on a graph attribute is not here: it stays on the list
    // operators below, which lower to a chain of `in` tests.
    if (isGraphOperator(row.operator)) {
        if (row.targetAttribute) {
            return `${attributeExpr}.${row.operator}(resource.attributes.${row.targetAttribute})`;
        }
        const targets = row.values.map((val: string) => celStringLiteral(val)).join(', ');
        return `${attributeExpr}.${row.operator}([${targets}])`;
    }

    const config = OPERATOR_CONFIG[row.operator];

    // Right-hand side is the accessed channel's attribute, not a literal:
    // user.attributes.X <op> resource.attributes.Y. Which operators may take one
    // depends on the attribute type as well — see operatorSupportsChannelTarget.
    // The literal-value forms below still apply when the row has no
    // targetAttribute, or when the operator cannot carry one.
    if (row.targetAttribute && operatorSupportsChannelTarget(row.operator, row.attribute_type)) {
        if (config?.type === 'comparison') {
            return `${attributeExpr} ${config.celOp} resource.attributes.${row.targetAttribute}`;
        }

        // What is left is a multiselect list-vs-list comparison, stored verbatim
        // as a member-function call the engine holds as-is.
        const fn = row.operator === OperatorLabel.HAS_ALL_OF ? 'hasAllOf' : 'hasAnyOf';
        return `${attributeExpr}.${fn}(resource.attributes.${row.targetAttribute})`;
    }

    // native_method (e.g. youngerThanDays) takes an unquoted integer argument.
    // A valid non-negative integer is normalized (stripping leading zeros);
    // anything else is emitted verbatim so the invalid rule surfaces an error on
    // save rather than being silently coerced to a different value (e.g. 0).
    if (config?.type === 'native_method') {
        const raw = (row.values.length > 0 ? row.values[0] : '').trim();
        const arg = isValidYoungerThanDaysValue(raw) ? String(parseInt(raw, 10)) : raw;
        return `${attributeExpr}.${config.celOp}(${arg})`;
    }

    // Native boolean attributes compare against an unquoted true/false literal.
    if (row.isBoolean && config?.type === 'comparison') {
        const value = row.values.length > 0 ? row.values[0] : 'false';
        return `${attributeExpr} ${config.celOp} ${value}`;
    }

    if (!config) {
        if (row.attribute_type === 'multiselect') {
            return row.values.map((val: string) => `${celStringLiteral(val)} in ${attributeExpr}`).join(' && ');
        }
        const valuesStr = row.values.map((val: string) => celStringLiteral(val)).join(', ');
        return `${attributeExpr} in [${valuesStr}]`;
    }

    if (config.type === 'list') {
        if (row.operator === OperatorLabel.HAS_ANY_OF) {
            const parts = row.values.map((val: string) => `${celStringLiteral(val)} ${config.celOp} ${attributeExpr}`);
            const orExpr = parts.join(' || ');
            return parts.length > 1 ? `(${orExpr})` : orExpr;
        }
        if (row.operator === OperatorLabel.HAS_ALL_OF) {
            return row.values.map((val: string) => `${celStringLiteral(val)} ${config.celOp} ${attributeExpr}`).join(' && ');
        }

        if (row.attribute_type === 'multiselect') {
            return row.values.map((val: string) => `${celStringLiteral(val)} ${config.celOp} ${attributeExpr}`).join(' && ');
        }
        const valuesStr = row.values.map((val: string) => celStringLiteral(val)).join(', ');
        return `${attributeExpr} ${config.celOp} [${valuesStr}]`;
    }

    const value = row.values.length > 0 ? row.values[0] : '';

    if (config.type === 'comparison') {
        return `${attributeExpr} ${config.celOp} ${celStringLiteral(value)}`;
    }

    return `${attributeExpr}.${config.celOp}(${celStringLiteral(value)})`;
}

// A row that forms part of the expression is only valid if its value satisfies
// the operator's requirements. Today this only constrains native methods such
// as youngerThanDays, whose argument must be a non-negative integer.
export function isRowValueValid(row: TableRow): boolean {
    const config = OPERATOR_CONFIG[row.operator];
    if (config?.type === 'native_method') {
        return isValidYoungerThanDaysValue(row.values.length > 0 ? row.values[0] : '');
    }
    return true;
}

export interface TableEditorProps {
    value: string;
    onChange: (value: string) => void;
    onValidate?: (isValid: boolean) => void;
    disabled?: boolean;
    userAttributes: UserPropertyField[];
    enableUserManagedAttributes: boolean;
    onParseError: (error: string) => void;
    channelId?: string;
    teamId?: string;
    actions: {
        getVisualAST: (expr: string) => Promise<ActionResult>;

        /** Overrides the searchUsersForExpression thunk backing the built-in TestResultsModal.
         *  Receives the test modal's chosen channel id as the trailing arg. */
        searchUsers?: (expression: string, term: string, after: string, limit: number, channelId?: string) => Promise<ActionResult<AccessControlTestResult>>;
    };

    // Props for user self-exclusion detection
    isSystemAdmin?: boolean;
    validateExpressionAgainstRequester?: (expression: string) => Promise<ActionResult<{requester_matches: boolean}>>;

    /**
     * When provided, the built-in TestResultsModal is suppressed and the
     * Test access rule button forwards its click to the parent. The parent
     * is responsible for rendering its own results modal — used by the
     * permission-rule editor so its dual-lane simulation modal can replace
     * the legacy expression-only one without changing the button's layout.
     */
    onTestClick?: () => void;

    /** Force the test button into the disabled state (overrides default). */
    testButtonDisabled?: boolean;

    /** Tooltip shown when the test button is disabled. Useful for explaining
     *  why simulation is unavailable (e.g. no attributes loaded). */
    testButtonTooltip?: string;

    /** Optional label override for the test button. Lets the
     *  permission-rule editor render "Simulate rules" instead of the
     *  default "Test access rule" copy. */
    testButtonLabel?: React.ReactNode;

    // Callback to notify parent when masked state changes (for CEL editor integration)
    onMaskedStateChange?: (hasMasked: boolean) => void;
}

// Finds the first available (non-disabled) attribute from a list of user attributes.
// An attribute is considered available if it doesn't have spaces in its NAME (the CEL identifier —
// not the display_name). New CPA fields cannot have spaces in name
// so hasSpaces only fires for grandfathered legacy fields.
// An attribute is considered "safe" (synced from LDAP/SAML, admin-managed, plugin-managed (protected), OR enableUserManagedAttributes is true).
export const findFirstAvailableAttributeFromList = (
    userAttributes: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): UserPropertyField | undefined => {
    return userAttributes.find((attr) => {
        const isValidCELIdentifier = CPA_FIELD_NAME_PATTERN.test(attr.name);

        // Mirror AttributeSelectorMenu: session attributes are always
        // selectable, so a session-only attribute set must yield a usable
        // default instead of failing rule creation.
        const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
        const isAdminManaged = attr.attrs?.managed === 'admin';
        const isProtected = attr.attrs?.protected;
        const allowed = isSessionAttributeField(attr) || isNativeField(attr) || isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;
        return isValidCELIdentifier && allowed;
    });
};

// Returns the operator a freshly-selected attribute of the given type should
// default to. Ranked attributes default to "is at least" (the canonical
// "Secret or above" clearance comparison); graph attributes to "covers all of",
// the hierarchy test the type exists for — the holder is at or above every
// option the rule names.
const defaultOperatorForType = (type?: string): OperatorLabel => {
    if (type === 'multiselect') {
        return OperatorLabel.HAS_ANY_OF;
    }
    if (type === 'rank') {
        return OperatorLabel.IS_AT_LEAST;
    }
    if (type === 'graph') {
        return OperatorLabel.COVERS_ALL;
    }
    return OperatorLabel.IS;
};

// Whether an operator is valid for an attribute of the given type. Mirrors the
// per-type operator sets shown by OperatorSelectorMenu.
const isOperatorValidForType = (op: string, type?: string): boolean => {
    if (type === 'multiselect') {
        return isMultiselectOperator(op);
    }
    if (type === 'rank') {
        return isRankOperator(op) || op === OperatorLabel.IS_NOT;
    }
    if (type === 'graph') {
        // The hierarchy predicates, plus the two list operators — on a graph
        // attribute those lower to a chain of `in` tests, which is the exact,
        // hierarchy-blind membership check. Every other operator is refused when
        // the policy is saved.
        return isGraphOperator(op) || isMultiselectOperator(op);
    }
    return !isMultiselectOperator(op) && !isRankOperator(op) && !isNativeMethodOperator(op) && !isGraphOperator(op);
};

// The field whose options a graph attribute draws on: the template it links to,
// or itself when it is the source. Two graph attributes can be compared exactly
// when these match, which also admits the pair where the channel attribute links
// directly to the user attribute. That is looser than the shared-template rule
// the other option-based types use, and it is the rule the server applies when
// the rule is saved.
const graphOptionOwner = (field: UserPropertyField): string => field.linked_field_id || field.id;

// Parses a CEL (Common Expression Language) string into a structured array of TableRow objects.
// This allows the expression to be displayed and edited in a user-friendly table format.
export const parseExpression = (visualAST: AccessControlVisualAST): TableRow[] => {
    const tableRows: TableRow[] = [];

    if (!visualAST) {
        return tableRows;
    }

    for (const node of visualAST.conditions) {
        let attr: string;
        let attributeObjectType = 'user';
        let isNative = false;

        // Extracts the attribute name, removing the CEL namespace prefix. The
        // two-segment forms (user.attributes.<name>, user.session.<name>) are
        // matched before the single-segment native form (user.<name>). The left
        // side is always the requesting user's attribute; a resource.attributes.*
        // reference only appears on the right (captured below as targetAttribute).
        if (node.attribute.startsWith(USER_ATTRIBUTE_CEL_PREFIX)) {
            attr = node.attribute.slice(USER_ATTRIBUTE_CEL_PREFIX.length);
        } else if (node.attribute.startsWith(SESSION_ATTRIBUTE_CEL_PREFIX)) {
            attr = node.attribute.slice(SESSION_ATTRIBUTE_CEL_PREFIX.length);
            attributeObjectType = SESSION_ATTRIBUTES_OBJECT_TYPE;
        } else if (node.attribute.startsWith('user.') && !node.attribute.slice(5).includes('.')) {
            // Native attributes are single-segment (e.g. user.email); a
            // remaining dot means an unknown multi-segment namespace.
            attr = node.attribute.slice(5); // Length of 'user.'
            isNative = true;
        } else {
            throw new Error(`Unknown attribute: ${node.attribute}`);
        }

        let op = OPERATOR_LABELS[node.operator];
        if (!op) {
            // Fallback for unknown operators, defaulting to 'is' logic
            op = OperatorLabel.IS;
        }

        // OPERATOR_LABELS maps '==' to the generic "is". On a ranked attribute the
        // same operator reads as "is exactly" so it round-trips to the ranked menu.
        if (node.attribute_type === 'rank' && op === OperatorLabel.IS) {
            op = OperatorLabel.IS_EXACTLY;
        }

        // A value_type of "attribute" whose RHS is a resource.attributes.*
        // selector means the condition compares the user attribute to the
        // accessed channel's attribute. Capture the target field; values are
        // unused in that case.
        //
        // Otherwise the visual AST carries typed values: native booleans arrive
        // as JS booleans and youngerThanDays arguments as numbers. Normalize to
        // the string form the table rows store, and remember booleans so
        // rowToCEL re-emits them unquoted.
        let targetAttribute: string | undefined;
        let isBoolean = false;
        let values: string[];
        if (node.value_type === VISUAL_AST_ATTRIBUTE_VALUE_TYPE &&
            typeof node.value === 'string' &&
            node.value.startsWith(RESOURCE_ATTRIBUTES_PREFIX)) {
            targetAttribute = node.value.slice(RESOURCE_ATTRIBUTES_PREFIX.length);
            values = [];
        } else if (Array.isArray(node.value)) {
            values = node.value.map((v) => String(v));
        } else if (typeof node.value === 'boolean') {
            isBoolean = true;
            values = [String(node.value)];
        } else if (node.value !== null && node.value !== undefined) {
            values = [String(node.value)];
        } else {
            values = [];
        }

        const tableRow: TableRow = {
            attribute: attr,
            attribute_object_type: attributeObjectType,
            operator: op,
            values,
            attribute_type: node.attribute_type,
            hasMaskedValues: node.has_masked_values === true,
        };

        // Only set the native/target flags when they apply so custom-profile-
        // attribute rows keep their original shape.
        if (isNative) {
            tableRow.isNative = true;
        }
        if (isBoolean) {
            tableRow.isBoolean = true;
        }
        if (targetAttribute) {
            tableRow.targetAttribute = targetAttribute;
        }

        tableRows.push(tableRow);
    }

    return tableRows;
};

// TableEditor provides a user-friendly table interface for constructing and editing
// CEL (Common Expression Language) expressions based on user attributes.
// It parses incoming CEL expressions into rows and reconstructs the expression upon changes.
// The biggest limitation is that all expressions are ANDed together, so it's not possible to
// have OR logic.
function TableEditor({
    value,
    onChange,
    onValidate,
    disabled = false,
    userAttributes,
    enableUserManagedAttributes,
    onParseError,
    channelId,
    teamId,
    actions,
    isSystemAdmin = false,
    validateExpressionAgainstRequester,
    onTestClick,
    testButtonDisabled,
    testButtonTooltip,
    testButtonLabel,
    onMaskedStateChange,
}: TableEditorProps): JSX.Element {
    const {formatMessage} = useIntl();

    const [rows, setRows] = useState<TableRow[]>([]);
    const [showTestResults, setShowTestResults] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [autoOpenAttributeMenuForRow, setAutoOpenAttributeMenuForRow] = useState<number | null>(null);

    // State for user self-exclusion detection (only applies to non-system-admins)
    const [userWouldBeExcluded, setUserWouldBeExcluded] = useState(false);

    // Derived state: whether any row has masked values
    const hasMaskedRows = useMemo(() => rows.some((r) => r.hasMaskedValues), [rows]);

    // The autocomplete returns both the requesting user's attributes and the
    // accessed channel's (resource) attributes, tagged by object_type. The left
    // picker only ever offers user attributes; channel attributes are offered
    // as comparison targets on the right side (resource.attributes.*).
    const {userFields, resourceAttributes} = useMemo(() => {
        const uf: UserPropertyField[] = [];
        const ra: UserPropertyField[] = [];
        for (const f of userAttributes) {
            if (f.object_type === CHANNEL_ATTRIBUTES_OBJECT_TYPE) {
                ra.push(f);
            } else {
                uf.push(f);
            }
        }
        return {userFields: uf, resourceAttributes: ra};
    }, [userAttributes]);

    // The field definition behind a row. Resolved by name AND namespace: a CPA
    // and a session attribute can share a name, so object_type disambiguates.
    // The left picker only offers user attributes, so this resolves against
    // userFields (channel fields are right-hand-side targets only). Undefined
    // when the rule names an attribute that no longer exists.
    const fieldForRow = useCallback((row: TableRow): UserPropertyField | undefined => {
        return userFields.find((attr) => attr.name === row.attribute && (attr.object_type || 'user') === (row.attribute_object_type || 'user'));
    }, [userFields]);

    // A row's live attribute type. The type stored on the row is a snapshot —
    // from the server visual AST at parse time, or the field type when the row
    // was added — and can be stale or, for an exact-membership condition,
    // deliberately imprecise: the server reports such a row as multiselect
    // whatever field it is on, because it reads no field types.
    const attributeTypeForRow = useCallback((row: TableRow): string | undefined => {
        return fieldForRow(row)?.type || row.attribute_type || undefined;
    }, [fieldForRow]);

    // Channel attributes the given user attribute may be compared against.
    // Same field type is required; for option-based types (select/multiselect/
    // rank) the two must also share an option scale, enforced structurally by
    // linking to the same template field (equal, non-null linked_field_id).
    // Graph attributes share an option pool under a looser rule — see
    // graphOptionOwner. Non-comparable pairs are also rejected server-side at
    // save/check.
    const comparableChannelFields = useCallback((userField?: UserPropertyField): UserPropertyField[] => {
        if (!userField) {
            return [];
        }
        const optionBased = userField.type === 'select' || userField.type === 'multiselect' || userField.type === 'rank';
        return resourceAttributes.filter((cf) => {
            if (cf.type !== userField.type) {
                return false;
            }
            if (userField.type === 'graph') {
                return graphOptionOwner(cf) === graphOptionOwner(userField);
            }
            if (optionBased) {
                return Boolean(userField.linked_field_id) && userField.linked_field_id === cf.linked_field_id;
            }
            return true;
        });
    }, [resourceAttributes]);

    // Prevents getVisualAST re-parse when expression change is from internal row editing.
    const isInternalChange = React.useRef(false);

    useEffect(() => {
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return undefined;
        }

        if (!value || value.trim() === '') {
            setRows([]);
            return undefined;
        }

        // Guard against out-of-order resolution: if `value` changes again (or the
        // component unmounts) before this getVisualAST resolves, ignore the stale
        // result so a previous parse can't overwrite the current rows (which would
        // surface as a row showing another attribute's values/operators).
        let cancelled = false;

        actions.getVisualAST(value).then((result) => {
            if (cancelled) {
                return;
            }
            if (result.error) {
                setRows([]);

                // Only call onParseError for actual parsing errors, not permission errors
                if (!result.error.message?.includes('403') && !result.error.message?.includes('Forbidden')) {
                    onParseError(result.error.message);
                }
                return;
            }

            setRows(parseExpression(result.data));
        }).catch((err) => {
            if (cancelled) {
                return;
            }
            setRows([]);
            if (onValidate) {
                onValidate(false);
            }

            // Only call onParseError for actual parsing errors, not permission errors
            if (!err.message?.includes('403') && !err.message?.includes('Forbidden')) {
                onParseError(err.message);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [value]);

    useEffect(() => {
        const checkUserSelfExclusion = async () => {
            if (isSystemAdmin || !value.trim() || !validateExpressionAgainstRequester) {
                setUserWouldBeExcluded(false);
                return;
            }

            try {
                const result = await validateExpressionAgainstRequester(value);
                setUserWouldBeExcluded(!result.data?.requester_matches);
            } catch {
                setUserWouldBeExcluded(false);
            }
        };

        checkUserSelfExclusion();
    }, [value, isSystemAdmin, validateExpressionAgainstRequester]);

    useEffect(() => {
        onMaskedStateChange?.(hasMaskedRows);
    }, [hasMaskedRows, onMaskedStateChange]);

    const updateExpression = useCallback((newRows: TableRow[]) => {
        // Include masked rows with no visible values: rowToCEL will emit an "in []"
        // placeholder so the backend merge can restore the hidden values on save.
        // A resource-target row is complete without literal values.
        const rowsThatCanFormExpressions = newRows.filter((row) => row.attribute && (row.values.length > 0 || row.hasMaskedValues || row.targetAttribute));

        const expr = rowsThatCanFormExpressions.map((row) => rowToCEL(row)).join(' && ');

        // A youngerThanDays row with a non-integer value emits invalid CEL; flag
        // the whole expression invalid so the rule can't be saved with a value
        // that would otherwise be silently coerced.
        const allValuesValid = rowsThatCanFormExpressions.every(isRowValueValid);

        isInternalChange.current = true;
        onChange(expr);
        if (onValidate) {
            onValidate((expr === '' || rowsThatCanFormExpressions.length > 0) && allValuesValid);
        }
    }, [onChange, onValidate]);

    const findFirstAvailableAttribute = useCallback(() => {
        return findFirstAvailableAttributeFromList(userFields, enableUserManagedAttributes);
    }, [userFields, enableUserManagedAttributes]);

    const addRow = useCallback(() => {
        if (userFields.length === 0) {
            onParseError('No user attributes available. Please ensure ABAC is properly configured and you have the necessary permissions.');
            return;
        }

        const firstAvailableAttribute = findFirstAvailableAttribute();
        if (!firstAvailableAttribute) {
            onParseError('No available user attributes found for rule creation.');
            return;
        }

        setRows((currentRows) => {
            const newRow: TableRow = {
                attribute: firstAvailableAttribute.name,
                attribute_object_type: firstAvailableAttribute.object_type,
                operator: isNativeField(firstAvailableAttribute) ? defaultOperatorForField(firstAvailableAttribute) : defaultOperatorForType(firstAvailableAttribute.type),
                values: [],
                attribute_type: firstAvailableAttribute.type || '',
                hasMaskedValues: false,
                isNative: isNativeField(firstAvailableAttribute),
                isBoolean: isNativeBooleanField(firstAvailableAttribute),
            };
            const newRows = [...currentRows, newRow];
            updateExpression(newRows); // Ensure expression is updated immediately
            setAutoOpenAttributeMenuForRow(newRows.length - 1); // Set for the new row
            return newRows;
        });
    }, [userFields, updateExpression, findFirstAvailableAttribute]);

    const removeRow = useCallback((index: number) => {
        setRows((currentRows) => {
            const newRows = currentRows.toSpliced(index, 1);
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    const requestRemoveRow = useCallback((index: number) => {
        // Masked rows have their remove button disabled — the row is read-only
        // because the server would 403 on a delete that strips hidden values.
        removeRow(index);
    }, [removeRow]);

    const updateRowAttribute = useCallback((index: number, attributeId: string) => {
        setRows((currentRows) => {
            // Resolve by unique id, not name: a CPA attribute and a session
            // attribute can share a name, and only the id pins down the correct
            // namespace (object_type) for CEL generation.
            const newAttributeObj = userAttributes.find((attr) => attr.id === attributeId);
            const newAttribute = newAttributeObj?.name || '';
            const newObjectType = newAttributeObj?.object_type || 'user';

            const newRows = [...currentRows];
            const current = newRows[index];
            const attributeChanged = current.attribute !== newAttribute ||
                (current.attribute_object_type || 'user') !== newObjectType;
            newRows[index] = {...current, attribute: newAttribute};

            if (attributeChanged) {
                newRows[index].values = [];

                // A resource target is type-specific to the old attribute; drop it.
                newRows[index].targetAttribute = undefined;

                const newType = newAttributeObj?.type || '';
                newRows[index].attribute_type = newType;
                newRows[index].attribute_object_type = newObjectType;
                newRows[index].isNative = isNativeField(newAttributeObj);
                newRows[index].isBoolean = isNativeBooleanField(newAttributeObj);

                // Reset the operator to a valid default when the current one isn't
                // offered for the new attribute. Native attributes advertise an
                // explicit operator set (e.g. native createat only allows "younger
                // than"); everything else validates against the attribute type
                // (rank, multiselect, …).
                const allowedOperators = allowedOperatorLabelsForField(newAttributeObj);
                if (allowedOperators) {
                    if (!allowedOperators.includes(newRows[index].operator)) {
                        newRows[index].operator = defaultOperatorForField(newAttributeObj);
                    }
                } else if (!isOperatorValidForType(currentRows[index].operator, newType)) {
                    newRows[index].operator = defaultOperatorForType(newType);
                }

                // Values were cleared — row is in an intermediate editing state.
                // Don't regenerate the expression now; it will be updated when
                // the user selects new values via updateRowValues.
                return newRows;
            }
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression, userAttributes]);

    const updateRowOperator = useCallback((index: number, newOperator: string) => {
        setRows((currentRows) => {
            const oldOperator = currentRows[index].operator;
            let newValues = [...currentRows[index].values];

            const wasMulti = isMultiValueOperator(oldOperator);
            const isMulti = isMultiValueOperator(newOperator);

            if (isMulti && !wasMulti) {
                // Transitioning TO a multi-value operator FROM a single-value operator:
                newValues = newValues.map((v) => v.trim()).filter((v) => v !== '');
            } else if (!isMulti && wasMulti) {
                // Transitioning TO a single-value operator FROM a multi-value operator:
                if (newValues.length > 1) {
                    newValues = [newValues[0]];
                }
            }

            const newRows = [...currentRows];
            newRows[index] = {
                ...currentRows[index],
                operator: newOperator,
                values: newValues,
            };

            // Drop the resource target when the new operator cannot carry one
            // (e.g. "in", "starts with", or the membership operators on a graph
            // attribute) — otherwise it would survive invisibly and be emitted in
            // a form the server refuses.
            if (!operatorSupportsChannelTarget(newOperator, attributeTypeForRow(currentRows[index]))) {
                newRows[index].targetAttribute = undefined;
            }

            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression, attributeTypeForRow]);

    const updateRowValues = useCallback((index: number, values: string[]) => {
        setRows((currentRows) => {
            const newRows = [...currentRows];

            // Literal value(s) and a channel-attribute target are mutually
            // exclusive: picking a value in the consolidated dropdown drops any
            // target the row was comparing against.
            newRows[index] = {...newRows[index], values, targetAttribute: undefined};
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    // Switch the row's right-hand side to the accessed channel's attribute
    // (resource.attributes.*). Literal values are cleared — the two are
    // mutually exclusive.
    const updateRowTarget = useCallback((index: number, targetAttribute: string) => {
        setRows((currentRows) => {
            const newRows = [...currentRows];
            newRows[index] = {...newRows[index], targetAttribute, values: []};
            updateExpression(newRows);
            return newRows;
        });
    }, [updateExpression]);

    return (
        <div
            className='table-editor'
            data-testid='table-editor'
        >
            <table className='table-editor__table'>
                <thead>
                    <tr className='table-editor__header-row'>
                        <th className='table-editor__column-header'>
                            <FormattedMessage
                                id='admin.access_control.table_editor.attribute'
                                defaultMessage='Attribute'
                            />
                        </th>
                        <th className='table-editor__column-header'>
                            <FormattedMessage
                                id='admin.access_control.table_editor.operator'
                                defaultMessage='Operator'
                            />
                        </th>
                        <th className='table-editor__column-header'>
                            <span className='table-editor__column-header-value'>
                                <FormattedMessage
                                    id='admin.access_control.table_editor.values'
                                    defaultMessage='Values'
                                />
                            </span>
                        </th>
                        <th className='table-editor__column-header-actions'/>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td
                                colSpan={4}
                                className='table-editor__blank-state'
                            >
                                <span>
                                    {formatMessage({
                                        id: 'admin.access_control.table_editor.blank_state',
                                        defaultMessage: 'Select a user attribute and values to create a rule',
                                    })}
                                </span>
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, index) => {
                            const field = fieldForRow(row);
                            const isYoungerThan = row.operator === OperatorLabel.YOUNGER_THAN;
                            const youngerThanValue = row.values.length > 0 ? row.values[0] : '';
                            const youngerThanInvalid = isYoungerThan && youngerThanValue.trim() !== '' && !isValidYoungerThanDaysValue(youngerThanValue);

                            // Channel attributes this row's user attribute may be
                            // compared against (offered as the right-hand side
                            // alongside literal values).
                            const targets = comparableChannelFields(field);

                            // Channel attributes this row's operator can compare
                            // against, if any. comparableChannelFields has
                            // already enforced the shared option scale; the
                            // operator and the attribute's type decide whether a
                            // target is offered at all.
                            const supportsTarget = targets.length > 0 &&
                                operatorSupportsChannelTarget(row.operator, attributeTypeForRow(row));
                            const cellDisabled = disabled || row.hasMaskedValues;
                            return (
                                <tr
                                    key={index}
                                    className='table-editor__row'
                                >
                                    <td className='table-editor__cell'>
                                        <AttributeSelectorMenu
                                            currentAttribute={row.attribute}
                                            currentAttributeObjectType={row.attribute_object_type}
                                            availableAttributes={userFields}
                                            disabled={cellDisabled}
                                            onChange={(attributeId) => updateRowAttribute(index, attributeId)}
                                            menuId={`attribute-selector-menu-${index}`}
                                            buttonId={`attribute-selector-button-${index}`}
                                            autoOpen={index === autoOpenAttributeMenuForRow}
                                            onMenuOpened={() => setAutoOpenAttributeMenuForRow(null)}
                                            enableUserManagedAttributes={enableUserManagedAttributes}
                                        />
                                    </td>
                                    <td className='table-editor__cell'>
                                        <OperatorSelectorMenu
                                            currentOperator={row.operator}
                                            disabled={cellDisabled}
                                            onChange={(operator) => updateRowOperator(index, operator)}

                                            // The live type, not the row's stored snapshot: a saved
                                            // rank rule whose server AST labeled the attribute
                                            // 'select' would otherwise show the default operator set
                                            // instead of the ranked one.
                                            attributeType={attributeTypeForRow(row)}
                                            allowedOperators={allowedOperatorLabelsForField(field)}
                                        />
                                    </td>
                                    <td className='table-editor__cell'>
                                        <div className='table-editor__value-cell'>
                                            <ValueSelectorMenu
                                                row={row}
                                                disabled={cellDisabled}
                                                updateValues={(values: string[]) => updateRowValues(index, values)}
                                                options={row.attribute ? field?.attrs?.options || [] : []}
                                                placeholder={isYoungerThan ? formatMessage({id: 'admin.access_control.table_editor.value.days_placeholder', defaultMessage: 'Number of days'}) : undefined}
                                                channelFields={supportsTarget ? targets : undefined}
                                                onSelectTarget={(name: string) => updateRowTarget(index, name)}
                                            />
                                            {youngerThanInvalid && (
                                                <div className='table-editor__value-error'>
                                                    <FormattedMessage
                                                        id='admin.access_control.table_editor.value.days_invalid'
                                                        defaultMessage='Enter a whole number of days (e.g. 30).'
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className='table-editor__cell-actions'>
                                        <button
                                            type='button'
                                            className='table-editor__row-remove'
                                            onClick={() => requestRemoveRow(index)}
                                            disabled={cellDisabled}
                                            aria-label={formatMessage({id: 'admin.access_control.table_editor.remove_row', defaultMessage: 'Remove row'})}
                                        >
                                            <i className='icon icon-trash-can-outline'/>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
                <tfoot>
                    <tr>
                        <td
                            colSpan={4}
                            className='table-editor__add-button-container'
                        >
                            <AddAttributeButton
                                onClick={addRow}
                                disabled={disabled || userFields.length === 0}
                            />
                        </td>
                    </tr>
                </tfoot>
            </table>

            <div className='table-editor__actions-row'>
                <HelpText
                    message={formatMessage({
                        id: 'admin.access_control.table_editor.help_text',
                        defaultMessage: 'Each row is a single condition that must be met for a user to comply with the policy. All rules are combined with logical AND operator (`&&`).',
                    })}
                />
                <div className='access-control-test-controls'>
                    <TestButton
                        onClick={onTestClick ?? (() => setShowTestResults(true))}
                        disabled={(testButtonDisabled ?? false) || disabled || (!onTestClick && !value) || userWouldBeExcluded || hasMaskedRows}
                        disabledTooltip={

                            // Precedence: an explicit parent-supplied tooltip
                            // paired with `testButtonDisabled` (the parent
                            // already chose what the user should see and why),
                            // then the user-excluded message, then any other
                            // testButtonTooltip the parent passed alongside
                            // other disable reasons. The earlier
                            // `userWouldBeExcluded ? … : tooltip` ternary
                            // silenced parent hints whenever the self-exclusion
                            // check happened to also be true.
                            (testButtonDisabled && testButtonTooltip) ||
                            (userWouldBeExcluded ? formatMessage({
                                id: 'admin.access_control.table_editor.user_excluded_tooltip',
                                defaultMessage: 'You cannot test access rules that would exclude you from the channel',
                            }) : testButtonTooltip)
                        }
                        label={testButtonLabel}
                    />
                </div>
            </div>

            {/* Built-in expression-only modal. Suppressed when the parent
              * provided an `onTestClick` override (used by the permission-rule
              * editor, which renders its own dual-lane simulation modal). With
              * no channelId, a resource.attributes.* rule gets a channel-picker
              * step inside the modal before the members list. */}
            {!onTestClick && showTestResults && (
                <TestResults
                    expression={value}
                    channelId={channelId}
                    teamId={teamId}
                    isStacked={true}
                    onExited={() => setShowTestResults(false)}
                    searchUsers={actions.searchUsers}
                />
            )}
            {showHelpModal && (
                <CELHelpModal
                    onExited={() => setShowHelpModal(false)}
                />
            )}
        </div>
    );
}

export default TableEditor;
