// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import Markdown from 'components/markdown';
import WithTooltip from 'components/with_tooltip';

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
}

// Map from CEL operator to UI label
export const OPERATOR_LABELS: Record<string, string> = {
    [CELOperator.EQUALS]: OperatorLabel.IS,
    [CELOperator.NOT_EQUALS]: OperatorLabel.IS_NOT,
    [CELOperator.STARTS_WITH]: OperatorLabel.STARTS_WITH,
    [CELOperator.ENDS_WITH]: OperatorLabel.ENDS_WITH,
    [CELOperator.CONTAINS]: OperatorLabel.CONTAINS,
    [CELOperator.IN]: OperatorLabel.IN,
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
};

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
        <button
            className='btn btn-sm btn-tertiary'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-lock-outline'/>
            <FormattedMessage
                id='admin.access_control.table_editor.test_access_rule'
                defaultMessage='Test access rule'
            />
        </button>
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
        <button
            className='btn btn-sm btn-tertiary'
            onClick={onClick}
            disabled={disabled}
        >
            <i className='icon icon-plus'/>
            <FormattedMessage
                id='admin.access_control.table_editor.add_attribute'
                defaultMessage='Add attribute'
            />
        </button>
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
