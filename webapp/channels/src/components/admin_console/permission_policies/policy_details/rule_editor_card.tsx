// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo} from 'react';
import {FormattedMessage, defineMessages, useIntl} from 'react-intl';
import type {MessageDescriptor} from 'react-intl';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';

import {BOT_SCOPE_HIDDEN_NATIVE} from '../../access_control/bot_scope';
import CELEditor from '../../access_control/editors/cel_editor/editor';
import {excludeHiddenNativeFields, isSimpleExpression, mergeSessionAttributes, toCELEditorAttributes} from '../../access_control/editors/shared';
import TableEditor, {type TableEditorProps} from '../../access_control/editors/table_editor/table_editor';

export type EditorMode = 'cel' | 'table';
export type PolicyScope = 'user' | 'bot';
export type SimulateBlockedReason = 'simulation_disabled' | 'no_permissions';

type ScopeText = {
    attributesTitle: MessageDescriptor;
    attributesSubtitle: MessageDescriptor;
    tableHelp?: MessageDescriptor;
    tableEmpty?: MessageDescriptor;
};

const userText = defineMessages({
    attributesTitle: {id: 'admin.permission_policies.edit.who.attributes_title', defaultMessage: 'User attribute requirements'},
    attributesSubtitle: {id: 'admin.permission_policies.edit.who.attributes_subtitle', defaultMessage: 'Select attributes and values that users must have for this policy'},
});

const botText = defineMessages({
    attributesTitle: {id: 'admin.permission_policies.edit.who.attributes_title_bot', defaultMessage: 'Bot attribute requirements'},
    attributesSubtitle: {id: 'admin.permission_policies.edit.who.attributes_subtitle_bot', defaultMessage: 'Select attributes and values that bots must have for this policy'},
    tableHelp: {id: 'admin.permission_policies.edit.table_help_text_bot', defaultMessage: 'Each row is a single condition that must be met for a bot to comply with the policy. All rules are combined with the logical AND operator (`&&`).'},
    tableEmpty: {id: 'admin.permission_policies.edit.table_empty_bot', defaultMessage: 'Select a bot attribute and values to create a rule'},
});

const SCOPE_TEXT: Record<PolicyScope, ScopeText> = {
    user: userText,
    bot: botText,
};

const SIMULATE_BLOCKED_TOOLTIP: Record<SimulateBlockedReason, MessageDescriptor> = defineMessages({
    simulation_disabled: {id: 'admin.permission_policies.edit.simulate_disabled_tooltip', defaultMessage: 'Rule simulation isn\'t enabled on this server.'},
    no_permissions: {id: 'admin.permission_policies.edit.simulate_no_permissions_tooltip', defaultMessage: 'Add a permission to this policy to simulate it.'},
});

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

    // Opens the policy simulator.
    onTestClick: () => void;

    // Why the simulator can't run yet; disables the test button.
    simulateBlockedBy?: SimulateBlockedReason;
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
    simulateBlockedBy,
}: Props) {
    const {formatMessage} = useIntl();
    const text = SCOPE_TEXT[scope];
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

    // Always override the editors' own test: it matches the bare expression
    // against every user, ignoring the policy's role, so it would list e.g.
    // guests under a Members policy or humans under a Bot accounts policy.
    const testButtonProps = {
        onTestClick,
        testButtonDisabled: Boolean(simulateBlockedBy),
        testButtonTooltip: simulateBlockedBy && formatMessage(SIMULATE_BLOCKED_TOOLTIP[simulateBlockedBy]),
        testButtonLabel: (
            <FormattedMessage
                id='admin.permission_policies.editor.simulate_rules'
                defaultMessage='Simulate rules'
            />
        ),
    };

    return (
        <Card
            expanded={true}
            className={'console'}
        >
            <Card.Header>
                <TitleAndButtonCardHeader
                    title={<FormattedMessage {...text.attributesTitle}/>}
                    subtitle={<FormattedMessage {...text.attributesSubtitle}/>}
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
                        helpText={text.tableHelp && formatMessage(text.tableHelp)}
                        emptyStateText={text.tableEmpty && formatMessage(text.tableEmpty)}
                        hiddenPickerAttributeNames={hiddenNativeNames}
                        {...testButtonProps}
                    />
                )}
            </Card.Body>
        </Card>
    );
}

export default RuleEditorCard;
