// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlTestResult, AccessControlVisualAST} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {SESSION_ATTRIBUTES_OBJECT_TYPE, isSessionAttributeField} from '@mattermost/types/properties_user';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import type {ActionResult} from 'mattermost-redux/types/actions';

import {CPA_FIELD_NAME_PATTERN} from 'utils/properties';

import AttributeSelectorMenu from './attribute_selector_menu';
import OperatorSelectorMenu from './operator_selector_menu';
import type {TableRow} from './value_selector_menu';
import ValueSelectorMenu from './value_selector_menu';

import CELHelpModal from '../../modals/cel_help/cel_help_modal';
import TestResultsModal from '../../modals/policy_test/test_modal';
import {AddAttributeButton, TestButton, HelpText, OPERATOR_CONFIG, OPERATOR_LABELS, OperatorLabel, isMultiValueOperator, isMultiselectOperator, isRankOperator, isNativeMethodOperator, celPathFor, isNativeField, isNativeBooleanField, allowedOperatorLabelsForField, defaultOperatorForField, isValidYoungerThanDaysValue, SESSION_ATTRIBUTE_CEL_PREFIX, USER_ATTRIBUTE_CEL_PREFIX} from '../shared';

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
    if (row.hasMaskedValues && row.values.length === 0) {
        return `${attributeExpr} in []`;
    }

    const config = OPERATOR_CONFIG[row.operator];

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

        /** Overrides the searchUsersForExpression thunk backing the built-in TestResultsModal. */
        searchUsers?: (expression: string, term: string, after: string, limit: number) => Promise<ActionResult<AccessControlTestResult>>;
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
// "Secret or above" clearance comparison).
const defaultOperatorForType = (type?: string): OperatorLabel => {
    if (type === 'multiselect') {
        return OperatorLabel.HAS_ANY_OF;
    }
    if (type === 'rank') {
        return OperatorLabel.IS_AT_LEAST;
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
    return !isMultiselectOperator(op) && !isRankOperator(op) && !isNativeMethodOperator(op);
};

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
        // matched before the single-segment native form (user.<name>).
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

        // The visual AST carries typed values: native booleans arrive as JS
        // booleans and youngerThanDays arguments as numbers. Normalize to the
        // string form the table rows store, and remember booleans so rowToCEL
        // re-emits them unquoted.
        let isBoolean = false;
        let values: string[];
        if (Array.isArray(node.value)) {
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

        // Only set the native flags when they apply so custom-profile-attribute
        // rows keep their original shape.
        if (isNative) {
            tableRow.isNative = true;
        }
        if (isBoolean) {
            tableRow.isBoolean = true;
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

    // Prevents getVisualAST re-parse when expression change is from internal row editing.
    const isInternalChange = React.useRef(false);

    useEffect(() => {
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }

        if (!value || value.trim() === '') {
            setRows([]);
            return;
        }

        actions.getVisualAST(value).then((result) => {
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
            setRows([]);
            if (onValidate) {
                onValidate(false);
            }

            // Only call onParseError for actual parsing errors, not permission errors
            if (!err.message?.includes('403') && !err.message?.includes('Forbidden')) {
                onParseError(err.message);
            }
        });
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
        const rowsThatCanFormExpressions = newRows.filter((row) => row.attribute && (row.values.length > 0 || row.hasMaskedValues));

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
        return findFirstAvailableAttributeFromList(userAttributes, enableUserManagedAttributes);
    }, [userAttributes, enableUserManagedAttributes]);

    const addRow = useCallback(() => {
        if (userAttributes.length === 0) {
            onParseError('No user attributes available. Please ensure ABAC is properly configured and you have the necessary permissions.');
            return;
        }

        const firstAvailableAttribute = findFirstAvailableAttribute();
        if (!firstAvailableAttribute) {
            onParseError('No available user attributes found for rule creation.');
            return;
        }

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
        const newRows = [...rows, newRow];
        setRows(newRows);
        setAutoOpenAttributeMenuForRow(newRows.length - 1);
        updateExpression(newRows);
    }, [userAttributes, updateExpression, findFirstAvailableAttribute, rows]);

    const removeRow = useCallback((index: number) => {
        const newRows = rows.toSpliced(index, 1);
        setRows(newRows);
        updateExpression(newRows);
    }, [rows, updateExpression]);

    const requestRemoveRow = useCallback((index: number) => {
        // Masked rows have their remove button disabled — the row is read-only
        // because the server would 403 on a delete that strips hidden values.
        removeRow(index);
    }, [removeRow]);

    const updateRowAttribute = useCallback((index: number, attributeId: string) => {
        // Resolve by unique id, not name: a CPA attribute and a session
        // attribute can share a name, and only the id pins down the correct
        // namespace (object_type) for CEL generation.
        const newAttributeObj = userAttributes.find((attr) => attr.id === attributeId);
        const newAttribute = newAttributeObj?.name || '';
        const newObjectType = newAttributeObj?.object_type || 'user';

        const newRows = [...rows];
        const current = newRows[index];
        const attributeChanged = current.attribute !== newAttribute ||
            (current.attribute_object_type || 'user') !== newObjectType;
        newRows[index] = {...current, attribute: newAttribute};

        if (attributeChanged) {
            newRows[index].values = [];

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
            } else if (!isOperatorValidForType(current.operator, newType)) {
                newRows[index].operator = defaultOperatorForType(newType);
            }

            // Values were cleared — row is in an intermediate editing state.
            // Don't regenerate the expression now; it will be updated when
            // the user selects new values via updateRowValues.
            setRows(newRows);
            return;
        }
        setRows(newRows);
        updateExpression(newRows);
    }, [updateExpression, userAttributes, rows]);

    const updateRowOperator = useCallback((index: number, newOperator: string) => {
        const oldOperator = rows[index].operator;
        let newValues = [...rows[index].values];

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

        const newRows = [...rows];
        newRows[index] = {
            ...rows[index],
            operator: newOperator,
            values: newValues,
        };

        setRows(newRows);
        updateExpression(newRows);
    }, [updateExpression, rows]);

    const updateRowValues = useCallback((index: number, values: string[]) => {
        const newRows = [...rows];
        newRows[index] = {...newRows[index], values};
        setRows(newRows);
        updateExpression(newRows);
    }, [updateExpression, rows]);

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
                            // Resolve by name AND namespace: a CPA and a session
                            // attribute can share a name, so object_type disambiguates.
                            const field = userAttributes.find((attr) => attr.name === row.attribute && (attr.object_type || 'user') === (row.attribute_object_type || 'user'));
                            const isYoungerThan = row.operator === OperatorLabel.YOUNGER_THAN;
                            const youngerThanValue = row.values.length > 0 ? row.values[0] : '';
                            const youngerThanInvalid = isYoungerThan && youngerThanValue.trim() !== '' && !isValidYoungerThanDaysValue(youngerThanValue);
                            return (
                                <tr
                                    key={index}
                                    className='table-editor__row'
                                >
                                    <td className='table-editor__cell'>
                                        <AttributeSelectorMenu
                                            currentAttribute={row.attribute}
                                            currentAttributeObjectType={row.attribute_object_type}
                                            availableAttributes={userAttributes}
                                            disabled={disabled || row.hasMaskedValues}
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
                                            disabled={disabled || row.hasMaskedValues}
                                            onChange={(operator) => updateRowOperator(index, operator)}

                                            // Use the row's own type, kept in sync by
                                            // addRow/updateRowAttribute/parseExpression. A name-only
                                            // lookup could resolve the wrong namespace when a user and
                                            // a session attribute share a name.
                                            attributeType={row.attribute_type || undefined}
                                            allowedOperators={allowedOperatorLabelsForField(field)}
                                        />
                                    </td>
                                    <td className='table-editor__cell'>
                                        <ValueSelectorMenu
                                            row={row}
                                            disabled={disabled || row.hasMaskedValues}
                                            updateValues={(values: string[]) => updateRowValues(index, values)}
                                            options={row.attribute ? field?.attrs?.options || [] : []}
                                            placeholder={isYoungerThan ? formatMessage({id: 'admin.access_control.table_editor.value.days_placeholder', defaultMessage: 'Number of days'}) : undefined}
                                        />
                                        {youngerThanInvalid && (
                                            <div className='table-editor__value-error'>
                                                <FormattedMessage
                                                    id='admin.access_control.table_editor.value.days_invalid'
                                                    defaultMessage='Enter a whole number of days (e.g. 30).'
                                                />
                                            </div>
                                        )}
                                    </td>
                                    <td className='table-editor__cell-actions'>
                                        <button
                                            type='button'
                                            className='table-editor__row-remove'
                                            onClick={() => requestRemoveRow(index)}
                                            disabled={disabled || row.hasMaskedValues}
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
                                disabled={disabled || userAttributes.length === 0}
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
                <TestButton
                    onClick={onTestClick ?? (() => setShowTestResults(true))}
                    disabled={(testButtonDisabled ?? false) || disabled || (!onTestClick && !value) || userWouldBeExcluded || hasMaskedRows}
                    disabledTooltip={

                        // Precedence: an explicit parent-supplied
                        // tooltip paired with `testButtonDisabled`
                        // wins (the parent already chose what the
                        // user should see and why), then the
                        // user-excluded message, then any other
                        // testButtonTooltip the parent passed
                        // alongside other disable reasons. The
                        // earlier `userWouldBeExcluded ? … : tooltip`
                        // ternary silenced parent hints whenever the
                        // self-exclusion check happened to also
                        // be true.
                        (testButtonDisabled && testButtonTooltip) ||
                        (userWouldBeExcluded ? formatMessage({
                            id: 'admin.access_control.table_editor.user_excluded_tooltip',
                            defaultMessage: 'You cannot test access rules that would exclude you from the channel',
                        }) : testButtonTooltip)
                    }
                    label={testButtonLabel}
                />
            </div>

            {/* Built-in expression-only modal. Suppressed when the parent
              * provided an `onTestClick` override (used by the permission-rule
              * editor, which renders its own dual-lane simulation modal). */}
            {!onTestClick && showTestResults && (
                <TestResultsModal
                    onExited={() => setShowTestResults(false)}
                    isStacked={true}
                    actions={{
                        openModal: () => {},
                        searchUsers: (term: string, after: string, limit: number) => {
                            if (actions.searchUsers) {
                                // Wrap in a thunk so TestResultsModal can dispatch it unchanged.
                                const search = actions.searchUsers;
                                return () => search(value, term, after, limit);
                            }

                            // Return the action for the modal to dispatch
                            return searchUsersForExpression(value, term, after, limit, channelId, teamId);
                        },
                    }}
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
