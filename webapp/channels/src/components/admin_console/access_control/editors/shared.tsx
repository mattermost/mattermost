// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage, FormattedMessage} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {AccessControlTestResult} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';
import {isSessionAttributeField} from '@mattermost/types/properties_user';

import {searchUsersForExpression} from 'mattermost-redux/actions/access_control';
import type {ActionResult} from 'mattermost-redux/types/actions';

import Markdown from 'components/markdown';

import TestResultsModal from '../modals/policy_test/test_modal';

import './shared.scss';

// Sentinel emitted by the server in masked CEL expressions for values the caller cannot see.
export const MASKED_VALUE_TOKEN_LITERAL = '"--------"';

// The accessed channel's attributes, the comparison target for a rule about the
// requesting user (whose own attributes are USER_ATTRIBUTE_CEL_PREFIX, below).
export const RESOURCE_ATTRIBUTES_PREFIX = 'resource.attributes.';

// value_type on a visual-AST condition. Matches model.ValueType: 0 = literal,
// 1 = attribute reference (the RHS is another attribute path, e.g. a
// resource.attributes.* selector rather than a quoted constant).
export const VISUAL_AST_ATTRIBUTE_VALUE_TYPE = 1;

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
    IN_CIDR = 'inCIDR',
    VERSION_EQ = 'versionEQ',
    VERSION_GT = 'versionGT',
    VERSION_GTE = 'versionGTE',
    VERSION_LT = 'versionLT',
    VERSION_LTE = 'versionLTE',
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

    IN_CIDR = 'in IP range',
    VERSION_IS = 'version is',
    VERSION_GREATER_THAN = 'version is greater than',
    VERSION_AT_LEAST = 'version is at least',
    VERSION_LESS_THAN = 'version is less than',
    VERSION_AT_MOST = 'version is at most',
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
    [CELOperator.IN_CIDR]: OperatorLabel.IN_CIDR,
    [CELOperator.VERSION_EQ]: OperatorLabel.VERSION_IS,
    [CELOperator.VERSION_GT]: OperatorLabel.VERSION_GREATER_THAN,
    [CELOperator.VERSION_GTE]: OperatorLabel.VERSION_AT_LEAST,
    [CELOperator.VERSION_LT]: OperatorLabel.VERSION_LESS_THAN,
    [CELOperator.VERSION_LTE]: OperatorLabel.VERSION_AT_MOST,
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
    [OperatorLabel.IN_CIDR]: {type: 'method', celOp: CELOperator.IN_CIDR},
    [OperatorLabel.VERSION_IS]: {type: 'method', celOp: CELOperator.VERSION_EQ},
    [OperatorLabel.VERSION_GREATER_THAN]: {type: 'method', celOp: CELOperator.VERSION_GT},
    [OperatorLabel.VERSION_AT_LEAST]: {type: 'method', celOp: CELOperator.VERSION_GTE},
    [OperatorLabel.VERSION_LESS_THAN]: {type: 'method', celOp: CELOperator.VERSION_LT},
    [OperatorLabel.VERSION_AT_MOST]: {type: 'method', celOp: CELOperator.VERSION_LTE},
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

// Field-advertised method operators (inCIDR, version*) are exclusive to attributes
// that declare them via attrs.operators. They must never be offered for—or left
// applied to—unrelated text attributes.
export function isFieldAdvertisedOperator(op: string): boolean {
    const config = OPERATOR_CONFIG[op];
    if (!config || config.type !== 'method') {
        return false;
    }
    return config.celOp === CELOperator.IN_CIDR ||
        config.celOp === CELOperator.VERSION_EQ ||
        config.celOp === CELOperator.VERSION_GT ||
        config.celOp === CELOperator.VERSION_GTE ||
        config.celOp === CELOperator.VERSION_LT ||
        config.celOp === CELOperator.VERSION_LTE;
}

// Native user attributes are referenced as `user.<name>` rather than the custom
// profile attribute form `user.attributes.<name>`.
export function isNativeField(field?: Pick<UserPropertyField, 'attrs'>): boolean {
    return Boolean(field?.attrs?.native);
}

// True when an attribute's values come from a controlled source (LDAP/SAML sync,
// admin-managed, plugin-protected, or owner-managed integration) and so cannot be
// set by users. Such attributes are safe to reference in access control policies.
export function hasControlledAttributeValues(field: Pick<UserPropertyField, 'attrs'>): boolean {
    const isSynced = Boolean(field.attrs?.ldap || field.attrs?.saml);
    const isAdminManaged = field.attrs?.managed === 'admin';
    const isProtected = Boolean(field.attrs?.protected);
    const isOwnerManaged = (field.attrs?.owners?.length ?? 0) > 0;
    return isSynced || isAdminManaged || isProtected || isOwnerManaged;
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

const daysValuePlaceholder = defineMessage({
    id: 'admin.access_control.table_editor.value.days_placeholder',
    defaultMessage: 'Number of days',
});

const cidrValuePlaceholder = defineMessage({
    id: 'admin.access_control.table_editor.value.cidr_placeholder',
    defaultMessage: 'CIDR range (e.g. 10.0.0.0/8)',
});

const versionValuePlaceholder = defineMessage({
    id: 'admin.access_control.table_editor.value.version_placeholder',
    defaultMessage: 'Version (e.g. 6.0.0)',
});

// CIDR/version operators have no client-side format validation, so the value
// input's placeholder is the only hint at the expected format.
export function valuePlaceholderForOperator(operator: string): MessageDescriptor | undefined {
    if (operator === OperatorLabel.YOUNGER_THAN) {
        return daysValuePlaceholder;
    }
    if (operator === OperatorLabel.IN_CIDR) {
        return cidrValuePlaceholder;
    }
    if (isFieldAdvertisedOperator(operator)) {
        // Only version operators reach here; inCIDR is handled above.
        return versionValuePlaceholder;
    }
    return undefined;
}

// Returns the operator labels a field may use. Fields advertise an explicit
// operator token list via attrs.operators; everything else falls back to the
// full set (operator menu still applies its multiselect filter).
export function allowedOperatorLabelsForField(field?: UserPropertyField): string[] | undefined {
    if (!field?.attrs?.operators) {
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

export type CELEditorAttribute = {attribute: string; values: string[]; isNative?: boolean; objectType?: string};

// Maps autocomplete fields to the reduced shape the CEL editor consumes, keeping
// native attributes and enabled session attributes (both always usable)
// alongside the safe custom profile attributes. Every attribute carries its
// object_type so the editor can bucket it (user vs user.session.*).
export function toCELEditorAttributes(
    fields: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): CELEditorAttribute[] {
    return fields.
        filter((attr) => {
            if (isSessionAttributeField(attr) || isNativeField(attr) || enableUserManagedAttributes) {
                return true;
            }
            return hasControlledAttributeValues(attr);
        }).
        map((attr) => ({
            attribute: attr.name,
            values: [],
            isNative: isNativeField(attr),
            objectType: attr.object_type,
        }));
}

// Matches a single CEL string literal: a double-quoted string (which may contain
// apostrophes and escaped double quotes) or a single-quoted string (which may
// contain double quotes and escaped single quotes). This mirrors what the CEL
// parser accepts and what celStringLiteral emits, so a value such as
// "Matt's Department" is still recognized as a simple expression.
const CEL_STRING = String.raw`(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')`;

// Empty list or comma-separated CEL string literals. Rejects unterminated /
// unescaped quotes that the previous `\[.*?\]` matcher would accept.
const CEL_STRING_LIST = String.raw`\[\s*(?:${CEL_STRING}(?:\s*,\s*${CEL_STRING})*)?\s*\]`;

// A selector reading an attribute of the channel being accessed, which a
// comparison may use in place of a literal.
const RESOURCE_SELECTOR = String.raw`resource\.attributes\.\w+`;

// The first pattern accepts ==, != and the ranked ordinal operators
// (>=, <=, >, <) against either a quoted value or a resource.attributes.*
// selector (comparing the user attribute to the accessed channel's). >= / <=
// precede > / < in the alternation so the two-char forms match before the
// one-char ones.
const SIMPLE_CONDITION_PATTERNS: RegExp[] = [
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\s*(==|!=|>=|<=|>|<)\s*(?:${CEL_STRING}|${RESOURCE_SELECTOR})$`),

    // Multiselect list-vs-list against the accessed channel's attribute,
    // stored verbatim as a member call: the receiver is the user's multiselect
    // attribute and the single argument is a resource.attributes.* selector
    // (never a literal — that form is the in-chain below).
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\.(?:hasAnyOf|hasAllOf)\(${RESOURCE_SELECTOR}\)$`),

    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\s+in\s+${CEL_STRING_LIST}$`),
    new RegExp(String.raw`^((${CEL_STRING_LIST})|${CEL_STRING})\s+in\s+user\.(?:attributes|session)\.\w+$`),
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\.startsWith\(${CEL_STRING}.*?\)$`),
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\.endsWith\(${CEL_STRING}.*?\)$`),
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\.contains\(${CEL_STRING}.*?\)$`),
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\.inCIDR\(${CEL_STRING}.*?\)$`),
    new RegExp(String.raw`^user\.(?:attributes|session)\.\w+\.version(?:EQ|GT|GTE|LT|LTE)\(${CEL_STRING}.*?\)$`),

    // Native user attributes (single segment after `user.`). Restricted to
    // the field/operator pairings the table editor can round-trip: boolean
    // equality for verified/isbot, string operators for email, and
    // youngerThanDays for createat. These cannot collide with the
    // two-segment custom-profile-attribute forms above.
    new RegExp(String.raw`^user\.(verified|isbot)\s*(==|!=)\s*(true|false)$`),
    new RegExp(String.raw`^user\.email\s*(==|!=)\s*${CEL_STRING}$`),
    new RegExp(String.raw`^user\.email\s+in\s+${CEL_STRING_LIST}$`),
    new RegExp(String.raw`^((${CEL_STRING_LIST})|${CEL_STRING})\s+in\s+user\.email$`),
    new RegExp(String.raw`^user\.email\.(startsWith|endsWith|contains)\(${CEL_STRING}.*?\)$`),
    new RegExp(String.raw`^user\.createat\.youngerThanDays\(\d+\)$`),
];

const MULTISELECT_GROUP_PART = new RegExp(String.raw`^${CEL_STRING}\s+in\s+user\.(?:attributes|session)\.\w+$`);

export function isSimpleCondition(s: string): boolean {
    const trimmed = s.trim();
    return SIMPLE_CONDITION_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isMultiselectOrGroup(s: string): boolean {
    const trimmed = s.trim();
    if (!trimmed.startsWith('(') || !trimmed.endsWith(')')) {
        return false;
    }
    const inner = trimmed.slice(1, -1);
    return inner.split('||').every((part) => {
        return MULTISELECT_GROUP_PART.test(part.trim());
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
// 2. Its values come from a controlled source (synced from LDAP/SAML, admin-managed,
//    plugin-protected, or owner-managed), it's a native attribute, OR user-managed
//    attributes are enabled
export function hasUsableAttributes(
    userAttributes: UserPropertyField[],
    enableUserManagedAttributes: boolean,
): boolean {
    return userAttributes.some((attr) => {
        const hasSpaces = attr.name.includes(' ');
        const allowed = isNativeField(attr) || hasControlledAttributeValues(attr) || enableUserManagedAttributes;
        return !hasSpaces && allowed;
    });
}

// Membership/parent policy editors operate on long-lived user attributes only.
// Session attributes are environmental and are rejected by the server for
// membership rules, so strip them before they reach the editors.
export function excludeSessionAttributes(fields: UserPropertyField[]): UserPropertyField[] {
    return fields.filter((field) => !isSessionAttributeField(field));
}

// CEL namespaces. CPA/user attributes are referenced as user.attributes.<name>;
// session attributes as user.session.<name> (the server convention).
export const USER_ATTRIBUTE_CEL_PREFIX = 'user.attributes.';
export const SESSION_ATTRIBUTE_CEL_PREFIX = 'user.session.';

// The CEL namespace is chosen by object_type, not by group id.
export function celPrefixForField(field: Pick<UserPropertyField, 'object_type'>): string {
    return isSessionAttributeField(field) ? SESSION_ATTRIBUTE_CEL_PREFIX : USER_ATTRIBUTE_CEL_PREFIX;
}

// Permission surfaces only. Appends enabled session attributes after the user
// attributes. Dedups by id and by object_type:name in case the autocomplete
// endpoint ever starts returning session attributes again. Returns the original
// array when there's nothing to add to preserve referential stability.
export function mergeSessionAttributes(
    autocomplete: UserPropertyField[],
    sessionFields: UserPropertyField[],
): UserPropertyField[] {
    if (sessionFields.length === 0) {
        return autocomplete;
    }
    const seenIds = new Set(autocomplete.map((field) => field.id));
    const seenKeys = new Set(autocomplete.map((field) => `${field.object_type}:${field.name}`));
    const additions = sessionFields.filter(
        (field) => !seenIds.has(field.id) && !seenKeys.has(`${field.object_type}:${field.name}`));
    return additions.length ? [...autocomplete, ...additions] : autocomplete;
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

// True when an expression compares against the accessed channel's attributes.
// Such a rule can only be tested against a concrete channel's values, so the
// test modal must resolve one — the editor's own scope, or a channel picked in
// the modal's first step.
export function referencesResourceAttributes(expression: string): boolean {
    // Strip quoted string literals first so a value like
    // "resource.attributes.minClearance" is not mistaken for an actual
    // attribute reference (which would wrongly force a test channel).
    // Simple quote stripping; doesn't handle escaped quotes inside a literal,
    // which these editors never emit — parse the AST if that ever changes.
    const withoutLiterals = expression.replace(/'[^']*'|"[^"]*"/g, '');
    return withoutLiterals.includes(RESOURCE_ATTRIBUTES_PREFIX);
}

interface TestResultsProps {
    expression: string;

    /** Channel to resolve resource.attributes.* against, when the editor has
     *  one of its own (channel settings). When absent and the rule references
     *  resource.attributes.*, the modal opens a channel-picker step first and
     *  threads the chosen id into the search. */
    channelId?: string;
    teamId?: string;
    isStacked?: boolean;
    onExited: () => void;

    /** Plugin override for the members search, forwarded from
     *  CELEditorActions.searchUsers. When provided it replaces the built-in
     *  searchUsersForExpression thunk. The picker's chosen channel id is
     *  threaded in as the trailing arg so a resource.attributes.* rule can be
     *  resolved against it (the override may ignore it if it resolves its own). */
    searchUsers?: (expression: string, term: string, after: string, limit: number, channelId?: string) => Promise<ActionResult<AccessControlTestResult>>;
}

// The built-in expression test/simulate results modal.
export function TestResults({expression, channelId, teamId, isStacked, onExited, searchUsers}: TestResultsProps): JSX.Element {
    const requireChannel = !channelId && referencesResourceAttributes(expression);
    return (
        <TestResultsModal
            onExited={onExited}
            isStacked={isStacked}
            requireChannel={requireChannel}
            actions={{
                openModal: () => {},
                searchUsers: (term: string, after: string, limit: number, pickedChannelId?: string) => {
                    if (searchUsers) {
                        // Wrap in a thunk so TestResultsModal can dispatch it unchanged.
                        // Thread the picker's channel (falling back to the editor's own
                        // scope) so a resource.attributes.* rule resolves against it —
                        // without this, such a rule tested here fails to sqlize server-side.
                        const search = searchUsers;
                        return () => search(expression, term, after, limit, pickedChannelId ?? channelId);
                    }
                    return searchUsersForExpression(expression, term, after, limit, pickedChannelId ?? channelId, teamId);
                },
            }}
        />
    );
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
