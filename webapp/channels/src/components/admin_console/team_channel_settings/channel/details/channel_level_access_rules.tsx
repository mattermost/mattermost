// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo, useRef} from 'react';
import {FormattedMessage, defineMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties';

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import AdminPanelWithButton from 'components/widgets/admin_console/admin_panel_with_button';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import type {GlobalState} from 'types/store';

import './channel_level_access_rules.scss';

interface ChannelLevelAccessRulesProps {
    channel: Channel;
    userAttributes: UserPropertyField[];
    onRulesChange: (hasChanges: boolean, expression: string, autoSync: boolean) => void;
    initialExpression?: string;
    initialAutoSync?: boolean;
    isDisabled?: boolean;
}

const ChannelLevelAccessRules: React.FC<ChannelLevelAccessRulesProps> = ({
    channel,
    userAttributes,
    onRulesChange,
    initialExpression = '',
    initialAutoSync = false,
    isDisabled = false,
}) => {
    // Get access control settings from Redux state
    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));

    // State for the access control expression
    const [expression, setExpression] = useState(initialExpression);
    const [originalExpression, setOriginalExpression] = useState(initialExpression);

    // Auto-sync members toggle state
    const [autoSyncMembers, setAutoSyncMembers] = useState(initialAutoSync);
    const [originalAutoSyncMembers, setOriginalAutoSyncMembers] = useState(initialAutoSync);

    // Form validation state
    const [formError, setFormError] = useState('');

    const actions = useChannelAccessControlActions(channel.id);

    // Track initialization to prevent resetting original values
    const originalValuesInitialized = useRef(false);

    // Initialize values on prop changes
    useEffect(() => {
        setExpression(initialExpression);
        setAutoSyncMembers(initialAutoSync);

        // Only set original values the first time we receive them
        if (!originalValuesInitialized.current) {
            setOriginalExpression(initialExpression);
            setOriginalAutoSyncMembers(initialAutoSync);
            originalValuesInitialized.current = true;
        }
    }, [initialExpression, initialAutoSync]);

    // Detect changes and notify parent
    const hasChanges = useMemo(() => {
        return expression !== originalExpression || autoSyncMembers !== originalAutoSyncMembers;
    }, [expression, originalExpression, autoSyncMembers, originalAutoSyncMembers]);

    useEffect(() => {
        onRulesChange(hasChanges, expression, autoSyncMembers);
    }, [hasChanges, expression, autoSyncMembers, onRulesChange]);

    const handleExpressionChange = useCallback((newExpression: string) => {
        setExpression(newExpression);
        setFormError('');
    }, []);

    const handleAutoSyncToggle = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        setAutoSyncMembers(event.target.checked);
    }, []);

    const handleParseError = useCallback((error: string) => {
        setFormError(error);
    }, []);

    const renderAutoSyncSection = () => {
        if (!expression.trim()) {
            return null;
        }

        return (
            <div className='channel-access-rules__auto-sync'>
                <div className='channel-access-rules__auto-sync-divider'/>
                <div className='channel-access-rules__auto-sync-content'>
                    <label className='channel-access-rules__auto-sync-label'>
                        <input
                            type='checkbox'
                            checked={autoSyncMembers}
                            onChange={handleAutoSyncToggle}
                            disabled={isDisabled}
                            className='channel-access-rules__auto-sync-checkbox'
                        />
                        <span className='channel-access-rules__auto-sync-text'>
                            <FormattedMessage
                                id='admin.channel_details.rules.auto_sync'
                                defaultMessage='Auto-add members based on access rules'
                            />
                        </span>
                    </label>
                    <div className='channel-access-rules__auto-sync-help'>
                        <FormattedMessage
                            id='admin.channel_details.rules.auto_sync_help'
                            defaultMessage='Users who match the configured attribute values will be automatically added as members'
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <AdminPanelWithButton
                id='channel_level_access_rules'
                title={defineMessage({
                    id: 'admin.channel_details.rules.title',
                    defaultMessage: 'Channel-Specific Access Rules',
                })}
                subtitle={defineMessage({
                    id: 'admin.channel_details.rules.subtitle',
                    defaultMessage: 'Define additional rules specific to this channel. These rules work in addition to any parent policies applied above.',
                })}
                className='channel-level-access-rules'
            >
                {/* TableEditor for creating access rules */}
                <div className='channel-access-rules__editor'>
                    <TableEditor
                        value={expression}
                        onChange={handleExpressionChange}
                        onValidate={() => setFormError('')}
                        userAttributes={userAttributes}
                        onParseError={handleParseError}
                        channelId={channel.id}
                        actions={{
                            getVisualAST: actions.getVisualAST,
                        }}
                        enableUserManagedAttributes={accessControlSettings?.EnableUserManagedAttributes || false}
                        disabled={isDisabled}
                    />

                    {formError && (
                        <div className='channel-access-rules__error'>
                            <i className='icon icon-alert-outline'/>
                            <span>{formError}</span>
                        </div>
                    )}
                </div>

                {renderAutoSyncSection()}
            </AdminPanelWithButton>

        </>
    );
};

export default ChannelLevelAccessRules;
