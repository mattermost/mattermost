// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {MessageDescriptor} from 'react-intl';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';

import {CodeTagsIcon, TableLargeIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import AdminPanel from 'components/widgets/admin_console/admin_panel';

import CELEditor from '../../access_control/editors/cel_editor/editor';
import {isSimpleExpression, mergeSessionAttributes, toCELEditorAttributes} from '../../access_control/editors/shared';
import TableEditor from '../../access_control/editors/table_editor/table_editor';
import type {TableEditorProps} from '../../access_control/editors/table_editor/table_editor';

const messages = defineMessages({
    rulesLabel: {id: 'admin.permission_policies.edit.mode.rules_label', defaultMessage: 'Attribute-based rules'},
    modeSwitch: {id: 'admin.permission_policies.edit.mode.switch_aria', defaultMessage: 'Editor mode'},
    modeSimple: {id: 'admin.permission_policies.edit.mode.simple', defaultMessage: 'Simple'},
    modeAdvanced: {id: 'admin.permission_policies.edit.mode.advanced', defaultMessage: 'Advanced'},
    noAttributes: {id: 'admin.permission_policies.edit.no_usable_attributes_tooltip', defaultMessage: 'Please configure user attributes to use the editor.'},
    complex: {id: 'admin.permission_policies.edit.complex_expression_tooltip', defaultMessage: 'Complex expression detected. Simple expressions editor is not available at the moment.'},
    simulate: {id: 'admin.permission_policies.editor.simulate_rules', defaultMessage: 'Simulate rules'},
});

type EditorMode = 'cel' | 'table';

type Props = {
    title: MessageDescriptor;
    subtitle: MessageDescriptor;
    editorMode: EditorMode;
    onEditorModeChange: (mode: EditorMode) => void;
    expression: string;
    onExpressionChange: (value: string) => void;
    noUsableAttributes: boolean;
    userFields: UserPropertyField[];
    sessionFields: UserPropertyField[];
    resourceFields: UserPropertyField[];
    mergedAttributes: UserPropertyField[];
    enableUserManagedAttributes: boolean;
    actions: TableEditorProps['actions'];
    onParseError: () => void;
    onTestClick?: () => void;
};

export default function PolicyExpressionSection({
    title,
    subtitle,
    editorMode,
    onEditorModeChange,
    expression,
    onExpressionChange,
    noUsableAttributes,
    userFields,
    sessionFields,
    resourceFields,
    mergedAttributes,
    enableUserManagedAttributes,
    actions,
    onParseError,
    onTestClick,
}: Props) {
    const {formatMessage} = useIntl();
    const simpleBlocked = noUsableAttributes || (editorMode === 'cel' && !isSimpleExpression(expression));
    let editorModeTooltip: string | undefined;
    if (noUsableAttributes) {
        editorModeTooltip = formatMessage(messages.noAttributes);
    } else if (editorMode === 'cel' && !isSimpleExpression(expression)) {
        editorModeTooltip = formatMessage(messages.complex);
    }

    let simpleTab = (
        <button
            type='button'
            role='tab'
            id='pp-mode-simple'
            aria-selected={editorMode === 'table'}
            aria-controls='pp-rules-view'
            className={`pp-mode-option ${editorMode === 'table' ? 'pp-mode-option--active' : ''}`}
            disabled={simpleBlocked}
            onClick={() => onEditorModeChange('table')}
        >
            <span aria-hidden={true}>
                <TableLargeIcon size={16}/>
            </span>
            <FormattedMessage {...messages.modeSimple}/>
        </button>
    );
    if (simpleBlocked && editorModeTooltip) {
        simpleTab = (
            <WithTooltip title={editorModeTooltip}>
                {simpleTab}
            </WithTooltip>
        );
    }

    const testLabel = onTestClick ? <FormattedMessage {...messages.simulate}/> : undefined;

    return (
        <AdminPanel
            id='permission_policy_expression'
            title={title}
            subtitle={subtitle}
        >
            <div className='pp-mode-bar'>
                <span className='pp-mode-label'>
                    <FormattedMessage {...messages.rulesLabel}/>
                </span>
                <div
                    className='pp-mode-switch'
                    role='tablist'
                    aria-label={formatMessage(messages.modeSwitch)}
                >
                    <button
                        type='button'
                        role='tab'
                        id='pp-mode-advanced'
                        aria-selected={editorMode === 'cel'}
                        aria-controls='pp-rules-view'
                        className={`pp-mode-option ${editorMode === 'cel' ? 'pp-mode-option--active' : ''}`}
                        disabled={noUsableAttributes}
                        onClick={() => onEditorModeChange('cel')}
                    >
                        <span aria-hidden={true}>
                            <CodeTagsIcon size={16}/>
                        </span>
                        <FormattedMessage {...messages.modeAdvanced}/>
                    </button>
                    {simpleTab}
                </div>
            </div>
            <div
                id='pp-rules-view'
                role='tabpanel'
                aria-labelledby={editorMode === 'cel' ? 'pp-mode-advanced' : 'pp-mode-simple'}
            >
                {editorMode === 'cel' ? (
                    <CELEditor
                        value={expression}
                        onChange={onExpressionChange}
                        onValidate={() => {}}
                        disabled={noUsableAttributes}
                        userAttributes={toCELEditorAttributes(mergeSessionAttributes(userFields, sessionFields), enableUserManagedAttributes)}
                        resourceAttributes={resourceFields.map((attr) => ({
                            attribute: attr.name,
                        }))}
                        onTestClick={onTestClick}
                        testButtonLabel={testLabel}
                    />
                ) : (
                    <TableEditor
                        value={expression}
                        onChange={onExpressionChange}
                        onValidate={() => {}}
                        disabled={noUsableAttributes}
                        userAttributes={mergedAttributes}
                        onParseError={onParseError}
                        enableUserManagedAttributes={enableUserManagedAttributes}
                        actions={actions}
                        onTestClick={onTestClick}
                        testButtonLabel={testLabel}
                    />
                )}
            </div>
        </AdminPanel>
    );
}
