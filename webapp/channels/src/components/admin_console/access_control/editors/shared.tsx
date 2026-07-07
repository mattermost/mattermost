// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import Markdown from 'components/markdown';

import './shared.scss';

// Sentinel emitted by the server in masked CEL expressions for values the caller cannot see.
export const MASKED_VALUE_TOKEN_LITERAL = '"--------"';

// CEL operator constants
export enum CELOperator {
    EQUALS = '==',
    NOT_EQUALS = '!=',
    GREATER_THAN = '>',
    GREATER_THAN_OR_EQUAL = '>=',
    LESS_THAN = '<',
    LESS_THAN_OR_EQUAL = '<=',
    STARTS_WITH = 'startsWith',
    ENDS_WITH = 'endsWith',
    CONTAINS = 'contains',
    IN = 'in',
    YOUNGER_THAN_DAYS = 'youngerThanDays',
}

// Operator label constants
export enum OperatorLabel {
    IS = 'is',
    IS_NOT = 'is not',
    STARTS_WITH = 'starts with',
    ENDS_WITH = 'ends with',
    CONTAINS = 'contains',
    IN = 'in',
    HAS_ANY_OF = 'has any of',
    HAS_ALL_OF = 'has all of',

    // Ranked-attribute comparison operators. These are shown only for
    // attributes of type 'rank' and replace the standard operator set there.
    // IS_NOT (above) is reused for the ranked "is not" (≠) operator.
    IS_EXACTLY = 'is exactly',
    IS_AT_LEAST = 'is at least',
    IS_GREATER_THAN = 'is greater than',
    IS_AT_MOST = 'is at most',
    IS_LESS_THAN = 'is less than',

    YOUNGER_THAN = 'younger than',
}

// Map from visual AST operator to UI label. The comparison symbols (>=, >, <, <=)
// are only ever produced by ranked attributes, so they map directly to the ranked
// labels. EQUALS/NOT_EQUALS map to the generic IS/IS_NOT here; parseExpression
// promotes EQUALS to IS_EXACTLY when the attribute is ranked.
export const OPERATOR_LABELS: Record<string, string> = {
    [CELOperator.EQUALS]: OperatorLabel.IS,
    [CELOperator.NOT_EQUALS]: OperatorLabel.IS_NOT,
    [CELOperator.GREATER_THAN_OR_EQUAL]: OperatorLabel.IS_AT_LEAST,
    [CELOperator.GREATER_THAN]: OperatorLabel.IS_GREATER_THAN,
    [CELOperator.LESS_THAN_OR_EQUAL]: OperatorLabel.IS_AT_MOST,
    [CELOperator.LESS_THAN]: OperatorLabel.IS_LESS_THAN,
    [CELOperator.STARTS_WITH]: OperatorLabel.STARTS_WITH,
    [CELOperator.ENDS_WITH]: OperatorLabel.ENDS_WITH,
    [CELOperator.CONTAINS]: OperatorLabel.CONTAINS,
    [CELOperator.IN]: OperatorLabel.IN,
    [CELOperator.YOUNGER_THAN_DAYS]: OperatorLabel.YOUNGER_THAN,
    hasAnyOf: OperatorLabel.HAS_ANY_OF,
    hasAllOf: OperatorLabel.HAS_ALL_OF,
};

// 'native_method' is a member call whose argument is emitted verbatim (e.g. an
// integer for youngerThanDays), unlike 'method' which quotes its string argument.
type OperatorType = 'comparison' | 'method' | 'list' | 'native_method';

// Map from UI label to operator configuration
export const OPERATOR_CONFIG: Record<string, {type: OperatorType; celOp: CELOperator}> = {
    [OperatorLabel.IS]: {type: 'comparison', celOp: CELOperator.EQUALS},
    [OperatorLabel.IS_NOT]: {type: 'comparison', celOp: CELOperator.NOT_EQUALS},
    [OperatorLabel.STARTS_WITH]: {type: 'method', celOp: CELOperator.STARTS_WITH},
    [OperatorLabel.ENDS_WITH]: {type: 'method', celOp: CELOperator.ENDS_WITH},
    [OperatorLabel.CONTAINS]: {type: 'method', celOp: CELOperator.CONTAINS},
    [OperatorLabel.IN]: {type: 'list', celOp: CELOperator.IN},
    [OperatorLabel.HAS_ANY_OF]: {type: 'list', celOp: CELOperator.IN},
    [OperatorLabel.HAS_ALL_OF]: {type: 'list', celOp: CELOperator.IN},

    // Ranked comparison operators emit `attr <op> "Option"`. The backend
    [OperatorLabel.IS_EXACTLY]: {type: 'comparison', celOp: CELOperator.EQUALS},
    [OperatorLabel.IS_AT_LEAST]: {type: 'comparison', celOp: CELOperator.GREATER_THAN_OR_EQUAL},
    [OperatorLabel.IS_GREATER_THAN]: {type: 'comparison', celOp: CELOperator.GREATER_THAN},
    [OperatorLabel.IS_AT_MOST]: {type: 'comparison', celOp: CELOperator.LESS_THAN_OR_EQUAL},
    [OperatorLabel.IS_LESS_THAN]: {type: 'comparison', celOp: CELOperator.LESS_THAN},

    [OperatorLabel.YOUNGER_THAN]: {type: 'native_method', celOp: CELOperator.YOUNGER_THAN_DAYS},
};

export function isMultiValueOperator(op: string): boolean {
    return op === OperatorLabel.IN || op === OperatorLabel.HAS_ANY_OF || op === OperatorLabel.HAS_ALL_OF;
}

export function isMultiselectOperator(op: string): boolean {
    return op === OperatorLabel.HAS_ANY_OF || op === OperatorLabel.HAS_ALL_OF;
}

// Ordinal comparison operators exclusive to ranked attributes. IS_NOT is
// intentionally excluded — it is shared with the standard operator set — so it
// is not filtered out of non-ranked attribute menus.
export function isRankOperator(op: string): boolean {
    return op === OperatorLabel.IS_EXACTLY ||
        op === OperatorLabel.IS_AT_LEAST ||
        op === OperatorLabel.IS_GREATER_THAN ||
        op === OperatorLabel.IS_AT_MOST ||
        op === OperatorLabel.IS_LESS_THAN;
}

// native_method operators (e.g. "younger than") are exclusive to the specific
// native attribute that advertises them via attrs.operators (currently only
// createat). They must never be offered for—or left applied to—any other
// attribute type.
export function isNativeMethodOperator(op: string): boolean {
    return OPERATOR_CONFIG[op]?.type === 'native_method';
}

// Native user attributes are referenced as `user.<name>` rather than the custom
// profile attribute form `user.attributes.<name>`.
export function isNativeField(field?: Pick<UserPropertyField, 'attrs'>): boolean {
    return Boolean(field?.attrs?.native);
}

// A native boolean attribute (e.g. user.verified) is modeled as a select whose
// options are exactly true/false. Its CEL literal must be emitted unquoted.
export function isNativeBooleanField(field?: UserPropertyField): boolean {
    if (!isNativeField(field) || field?.type !== 'select') {
        return false;
    }
    const options = field?.attrs?.options || [];
    return options.length > 0 && options.every((o) => o.name === 'true' || o.name === 'false');
}

// Builds the CEL left-hand side for an attribute name, honoring the native vs
// custom-profile-attribute prefix.
export function celPathFor(name: string, isNative: boolean): string {
    return isNative ? `user.${name}` : `user.attributes.${name}`;
}

// The youngerThanDays operator argument must be a non-negative integer (a whole
// number of days). Anything else (e.g. "ten", "-5", "3.5") is rejected so the
// editor surfaces an error instead of silently coercing the value.
export function isValidYoungerThanDaysValue(value: string): boolean {
    return (/^\d+$/).test(value.trim());
}

// Returns the operator labels a field may use. Native fields advertise their
// allowed operator tokens via attrs.operators; everything else falls back to the
// full set (operator menu still applies its multiselect filter).
export function allowedOperatorLabelsForField(field?: UserPropertyField): string[] | undefined {
    if (!isNativeField(field) || !field?.attrs?.operators) {
        return undefined;
    }
    return field.attrs.operators.
        map((token) => OPERATOR_LABELS[token]).
        filter((label): label is string => Boolean(label));
}

// Picks the operator a freshly added row should default to for the given field.
export function defaultOperatorForField(field?: UserPropertyField): string {
    const allowed = allowedOperatorLabelsForField(field);
    if (allowed && allowed.length > 0) {
        return allowed[0];
    }
    return field?.type === 'multiselect' ? OperatorLabel.HAS_ANY_OF : OperatorLabel.IS;
}

export type CELEditorAttribute = {attribute: string; values: string[]; isNative?: boolean};

// Maps autocomplete fields to the reduced shape the CEL editor consumes, keeping
// native attributes (always usable) alongside the safe custom profile attributes.
export function toCELEditorAttributes(
    fields: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): CELEditorAttribute[] {
    return fields.
        filter((attr) => {
            if (isNativeField(attr) || enableUserManagedAttributes) {
                return true;
            }
            const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
            const isAdminManaged = attr.attrs?.managed === 'admin';
            const isProtected = attr.attrs?.protected;
            return Boolean(isSynced || isAdminManaged || isProtected);
        }).
        map((attr) => ({
            attribute: attr.name,
            values: [],
            isNative: isNativeField(attr),
        }));
}

export function isSimpleCondition(s: string): boolean {
    const trimmed = s.trim();

    // The first pattern accepts ==, != and the ranked ordinal operators
    // (>=, <=, >, <) against a quoted value. >= / <= precede > / < in the
    // alternation so the two-char forms match before the one-char ones.
    return Boolean(
        trimmed.match(/^user\.attributes\.\w+\s*(==|!=|>=|<=|>|<)\s*['"][^'"]*['"]$/) ||
        trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/) ||
        trimmed.match(/^((\[.*?\])|['"][^'"]*['"])\s+in\s+user\.attributes\.\w+$/) ||
        trimmed.match(/^user\.attributes\.\w+\.startsWith\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.attributes\.\w+\.endsWith\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.attributes\.\w+\.contains\(['"][^'"]*['"].*?\)$/) ||

        // Native user attributes (single segment after `user.`). Restricted to
        // the field/operator pairings the table editor can round-trip: boolean
        // equality for verified/isbot, string operators for email, and
        // youngerThanDays for createat. These cannot collide with the
        // two-segment custom-profile-attribute forms above.
        trimmed.match(/^user\.(verified|isbot)\s*(==|!=)\s*(true|false)$/) ||
        trimmed.match(/^user\.email\s*(==|!=)\s*['"][^'"]*['"]$/) ||
        trimmed.match(/^user\.email\s+in\s+\[.*?\]$/) ||
        trimmed.match(/^((\[.*?\])|['"][^'"]*['"])\s+in\s+user\.email$/) ||
        trimmed.match(/^user\.email\.(startsWith|endsWith|contains)\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.createat\.youngerThanDays\(\d+\)$/),
    );
}

export function isMultiselectOrGroup(s: string): boolean {
    const trimmed = s.trim();
    if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
        return false;
    }
    const inner = trimmed.slice(1, -1);
    return inner.split('||').every((part) => {
        const p = part.trim();
        return Boolean(p.match(/^['"][^'"]*['"]\s+in\s+user\.attributes\.\w+$/));
    });
}

export function isSimpleExpression(expr: string): boolean {
    if (!expr) {
        return true;
    }
    return expr.split('&&').every((condition) => {
        return isSimpleCondition(condition) || isMultiselectOrGroup(condition);
    });
}

// Checks if there are any usable attributes for ABAC policies.
// An attribute is usable if:
// 1. It doesn't contain spaces (CEL incompatible)
// 2. It's either synced from LDAP/SAML, admin-managed, plugin-managed (protected), OR user-managed attributes are enabled
export function hasUsableAttributes(
    userAttributes: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): boolean {
    return userAttributes.some((attr) => {
        const hasSpaces = attr.name.includes(' ');
        const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
        const isAdminManaged = attr.attrs?.managed === 'admin';
        const isProtected = attr.attrs?.protected;
        const allowed = isNativeField(attr) || isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;
        return !hasSpaces && allowed;
    });
}

interface TestButtonProps {
    onClick: () => void;
    disabled: boolean;
    disabledTooltip?: string;

    /** Override the default "Test access rule" label. Used by the
     *  permission-rule editors to surface "Simulate rules" instead,
     *  matching the dual-lane simulation modal they open. */
    label?: React.ReactNode;
}

interface AddAttributeButtonProps {
    onClick: () => void;
    disabled: boolean;
}

interface HelpTextProps {
    message: string;
    onLearnMoreClick?: () => void;
}

export function TestButton({onClick, disabled, disabledTooltip, label}: TestButtonProps): JSX.Element {
    const button = (
        <Button
            emphasis='tertiary'
            size='sm'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-lock-outline'/>
            {label ?? (
                <FormattedMessage
                    id='admin.access_control.table_editor.test_access_rule'
                    defaultMessage='Test access rule'
                />
            )}
        </Button>
    );

    if (disabled && disabledTooltip) {
        return (
            <WithTooltip title={disabledTooltip}>
                {button}
            </WithTooltip>
        );
    }

    return button;
}

export function AddAttributeButton({onClick, disabled}: AddAttributeButtonProps): JSX.Element {
    return (
        <Button
            emphasis='tertiary'
            size='sm'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-plus'/>
            <FormattedMessage
                id='admin.access_control.table_editor.add_attribute'
                defaultMessage='Add attribute'
            />
        </Button>
    );
}

export function HelpText({message, onLearnMoreClick}: HelpTextProps): JSX.Element {
    return (
        <div className='editor__help-text'>
            <Markdown
                message={message}
                options={{mentionHighlight: false}}
            />
            {onLearnMoreClick && (
                <a
                    href='#'
                    className='editor__learn-more'
                    onClick={onLearnMoreClick}
                >
                    <FormattedMessage
                        id='admin.access_control.table_editor.learnMore'
                        defaultMessage='Learn more about creating access expressions with examples.'
                    />
                </a>
            )}
        </div>
    );
}
