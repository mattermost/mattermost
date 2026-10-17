// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';

import {SCOPE_COPY, type PolicyScope} from './scope_copy';

import {BOT_SCOPE_HIDDEN_NATIVE} from '../../access_control/bot_scope';
import CELEditor from '../../access_control/editors/cel_editor/editor';
import {excludeHiddenNativeFields, isSimpleExpression, mergeSessionAttributes, toCELEditorAttributes} from '../../access_control/editors/shared';
import TableEditor, {type TableEditorProps} from '../../access_control/editors/table_editor/table_editor';

export type EditorMode = 'cel' | 'table';

type Props = {
    scope: PolicyScope;
    expression: string;
    editorMode: EditorMode;
    onExpressionChange: (expression: string) => void;
    onEditorModeChange: (mode: EditorMode) => void;
    disabled: boolean;
    noUsableAttributes: boolean;
    userFields: UserPropertyField[];
    sessionFields: UserPropertyField[];
    resourceFields: UserPropertyField[];
    mergedAttributes: UserPropertyField[];
    enableUserManagedAttributes: boolean;
    abacActions: TableEditorProps['actions'];

    // Opens the policy simulator. Omit when simulation is unavailable: the
    // editors then fall back to their own expression-only test.
    onTestClick?: () => void;
};

function RuleEditorCard({
    scope,
    expression,
    editorMode,
    onExpressionChange,
    onEditorModeChange,
    disabled,
    noUsableAttributes,
    userFields,
    sessionFields,
    resourceFields,
    mergedAttributes,
    enableUserManagedAttributes,
    abacActions,
    onTestClick,
}: Props) {
    const {formatMessage} = useIntl();
    const copy = SCOPE_COPY[scope];
    const hiddenNativeNames = scope === 'bot' ? BOT_SCOPE_HIDDEN_NATIVE : undefined;

    const celUserAttributes = useMemo(
        () => toCELEditorAttributes(mergeSessionAttributes(excludeHiddenNativeFields(userFields, hiddenNativeNames), sessionFields), enableUserManagedAttributes),
        [userFields, hiddenNativeNames, sessionFields, enableUserManagedAttributes],
    );
    const editorDisabled = noUsableAttributes || disabled;
    const complexInCEL = editorMode === 'cel' && !isSimpleExpression(expression);

    let toggleTooltip: string | undefined;
    if (noUsableAttributes) {
        toggleTooltip = formatMessage({
            id: 'admin.permission_policies.edit.no_usable_attributes_tooltip',
            defaultMessage: 'Please configure user attributes to use the editor.',
        });
    } else if (complexInCEL) {
        toggleTooltip = formatMessage({
            id: 'admin.permission_policies.edit.complex_expression_tooltip',
            defaultMessage: 'Complex expression detected. Simple expressions editor is not available at the moment.',
        });
    }

    // The editors' own test runs the bare expression, which would list humans
    // as matching a bot-only rule, so bot scope can only test via the simulator.
    const testBlocked = scope === 'bot' && !onTestClick;
    const testButtonProps = {
        onTestClick,
        testButtonDisabled: testBlocked,
        testButtonTooltip: testBlocked ? formatMessage({
            id: 'admin.permission_policies.edit.bot_test_unavailable_tooltip',
            defaultMessage: 'Testing the rule alone isn\'t available for bot account policies.',
        }) : undefined,
        testButtonLabel: onTestClick ? (
            <FormattedMessage
                id='admin.permission_policies.editor.simulate_rules'
                defaultMessage='Simulate rules'
            />
        ) : undefined,
    };

    return (
        <Card
            expanded={true}
            className={'console'}
        >
            <Card.Header>
                <TitleAndButtonCardHeader
                    title={<FormattedMessage {...copy.attributesTitle}/>}
                    subtitle={<FormattedMessage {...copy.attributesSubtitle}/>}
                    buttonText={editorMode === 'table' ? (
                        <FormattedMessage
                            id='admin.permission_policies.edit.switch_to_advanced'
                            defaultMessage='Switch to Advanced Mode'
                        />
                    ) : (
                        <FormattedMessage
                            id='admin.permission_policies.edit.switch_to_simple'
                            defaultMessage='Switch to Simple Mode'
                        />
                    )}
                    onClick={() => onEditorModeChange(editorMode === 'table' ? 'cel' : 'table')}
                    isDisabled={noUsableAttributes || complexInCEL}
                    tooltipText={toggleTooltip}
                />
            </Card.Header>
            <Card.Body>
                {editorMode === 'cel' ? (
                    <CELEditor
                        value={expression}
                        onChange={onExpressionChange}
                        disabled={editorDisabled}
                        userAttributes={celUserAttributes}
                        resourceAttributes={resourceFields.map((attr) => ({attribute: attr.name}))}
                        {...testButtonProps}
                    />
                ) : (
                    <TableEditor
                        value={expression}
                        onChange={onExpressionChange}
                        disabled={editorDisabled}
                        userAttributes={mergedAttributes}
                        onParseError={() => onEditorModeChange('cel')}
                        enableUserManagedAttributes={enableUserManagedAttributes}
                        actions={abacActions}
                        helpText={copy.tableHelp && formatMessage(copy.tableHelp)}
                        emptyStateText={copy.tableEmpty && formatMessage(copy.tableEmpty)}
                        hiddenPickerAttributeNames={hiddenNativeNames}
                        {...testButtonProps}
                    />
                )}
            </Card.Body>
        </Card>
    );
}

export default RuleEditorCard;
