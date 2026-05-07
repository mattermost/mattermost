// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserPropertyField} from '@mattermost/types/properties';

import Markdown from 'components/markdown';

import './shared.scss';

// CEL operator constants
export enum CELOperator {
    EQUALS = '==',
    NOT_EQUALS = '!=',
    STARTS_WITH = 'startsWith',
    ENDS_WITH = 'endsWith',
    CONTAINS = 'contains',
    IN = 'in',
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
}

// Map from visual AST operator to UI label
export const OPERATOR_LABELS: Record<string, string> = {
    [CELOperator.EQUALS]: OperatorLabel.IS,
    [CELOperator.NOT_EQUALS]: OperatorLabel.IS_NOT,
    [CELOperator.STARTS_WITH]: OperatorLabel.STARTS_WITH,
    [CELOperator.ENDS_WITH]: OperatorLabel.ENDS_WITH,
    [CELOperator.CONTAINS]: OperatorLabel.CONTAINS,
    [CELOperator.IN]: OperatorLabel.IN,
    hasAnyOf: OperatorLabel.HAS_ANY_OF,
    hasAllOf: OperatorLabel.HAS_ALL_OF,
};

type OperatorType = 'comparison' | 'method' | 'list';

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
};

export function isMultiValueOperator(op: string): boolean {
    return op === OperatorLabel.IN || op === OperatorLabel.HAS_ANY_OF || op === OperatorLabel.HAS_ALL_OF;
}

export function isMultiselectOperator(op: string): boolean {
    return op === OperatorLabel.HAS_ANY_OF || op === OperatorLabel.HAS_ALL_OF;
}

export function isSimpleCondition(s: string): boolean {
    const trimmed = s.trim();
    return Boolean(
        trimmed.match(/^user\.attributes\.\w+\s*(==|!=)\s*['"][^'"]*['"]$/) ||
        trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/) ||
        trimmed.match(/^((\[.*?\])|['"][^'"]*['"])\s+in\s+user\.attributes\.\w+$/) ||
        trimmed.match(/^user\.attributes\.\w+\.startsWith\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.attributes\.\w+\.endsWith\(['"][^'"]*['"].*?\)$/) ||
        trimmed.match(/^user\.attributes\.\w+\.contains\(['"][^'"]*['"].*?\)$/),
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
        const allowed = isSynced || isAdminManaged || isProtected || enableUserManagedAttributes;
        return !hasSpaces && allowed;
    });
}

interface TestButtonProps {
    onClick: () => void;
    disabled: boolean;
    disabledTooltip?: string;
}

interface AddAttributeButtonProps {
    onClick: () => void;
    disabled: boolean;
}

interface HelpTextProps {
    message: string;
    onLearnMoreClick?: () => void;
}

export function TestButton({onClick, disabled, disabledTooltip}: TestButtonProps): JSX.Element {
    const button = (
        <Button
            emphasis='tertiary'
            size='sm'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-lock-outline'/>
            <FormattedMessage
                id='admin.access_control.table_editor.test_access_rule'
                defaultMessage='Test access rule'
            />
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
