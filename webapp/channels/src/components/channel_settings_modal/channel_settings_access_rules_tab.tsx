// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {UserPropertyField} from '@mattermost/types/properties';

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import SystemPolicyIndicator from 'components/system_policy_indicator';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';

import type {GlobalState} from 'types/store';

import './channel_settings_access_rules_tab.scss';

type ChannelSettingsAccessRulesTabProps = {
    channel: Channel;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
};

function ChannelSettingsAccessRulesTab({
    channel,
    setAreThereUnsavedChanges,
    showTabSwitchError,
}: ChannelSettingsAccessRulesTabProps) {
    const {formatMessage} = useIntl();

    // Get access control settings from Redux state
    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));

    // State for the access control expression and user attributes
    const [expression, setExpression] = useState('');
    const [originalExpression, setOriginalExpression] = useState('');
    const [userAttributes, setUserAttributes] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);

    // Auto-sync members toggle state
    const [autoSyncMembers, setAutoSyncMembers] = useState(false);
    const [originalAutoSyncMembers, setOriginalAutoSyncMembers] = useState(false);

    // SaveChangesPanel state
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [formError, setFormError] = useState('');

    const actions = useChannelAccessControlActions();

    // Fetch system policies applied to this channel
    const {policies: systemPolicies, loading: policiesLoading} = useChannelSystemPolicies(channel);

    // Load user attributes on component mount
    useEffect(() => {
        const loadAttributes = async () => {
            try {
                const result = await actions.getAccessControlFields('', 100);
                if (result.data) {
                    setUserAttributes(result.data);
                }
                setAttributesLoaded(true);
            } catch (error) {
                // do nothing for now, we might want to show an error message in the future
            }
        };

        loadAttributes();
    }, [actions]);

    // Load existing channel access rules (placeholder for now)
    useEffect(() => {
        // TODO: Load existing channel access rules from the backend
        // For now, we'll just set empty values
        const existingExpression = ''; // This would come from the channel's existing policy
        const existingAutoSync = false; // This would come from the channel's existing policy

        setExpression(existingExpression);
        setOriginalExpression(existingExpression);
        setAutoSyncMembers(existingAutoSync);
        setOriginalAutoSyncMembers(existingAutoSync);
    }, [channel]);

    // Update parent component when changes occur
    useEffect(() => {
        const unsavedChanges =
            expression !== originalExpression ||
            autoSyncMembers !== originalAutoSyncMembers;

        setAreThereUnsavedChanges?.(unsavedChanges);
    }, [expression, originalExpression, autoSyncMembers, originalAutoSyncMembers, setAreThereUnsavedChanges]);

    const handleExpressionChange = useCallback((newExpression: string) => {
        setExpression(newExpression);

        // Don't clear form error here - let validation determine if the error should be cleared
        setSaveChangesPanelState(undefined);
    }, []);

    const handleParseError = useCallback(() => {
        // eslint-disable-next-line no-console
        console.warn('Failed to parse expression in table editor');
        setFormError(formatMessage({
            id: 'channel_settings.access_rules.parse_error',
            defaultMessage: 'Invalid expression format',
        }));
    }, [formatMessage]);

    const handleAutoSyncToggle = useCallback(() => {
        const newValue = !autoSyncMembers;
        setAutoSyncMembers(newValue);

        // Placeholder: Log the toggle state
        // eslint-disable-next-line no-console
        console.log('Auto-sync members toggled:', newValue);
    }, [autoSyncMembers]);

    // Handle save action
    const handleSave = useCallback(async (): Promise<boolean> => {
        try {
            // Placeholder: Log the data that would be saved
            // eslint-disable-next-line no-console
            console.log('Saving channel access rules:', {
                channelId: channel.id,
                expression,
                autoSyncMembers,
            });

            // TODO: Implement actual save logic here
            // This would call the backend API to save the access rules

            // Simulate successful save
            setOriginalExpression(expression);
            setOriginalAutoSyncMembers(autoSyncMembers);

            // Show alert for demo purposes
            // eslint-disable-next-line no-alert
            alert(`Access rules saved!\nExpression: ${expression || '(none)'}\nAuto-sync: ${autoSyncMembers ? 'Enabled' : 'Disabled'}`);

            return true;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to save access rules:', error);
            setFormError(formatMessage({
                id: 'channel_settings.access_rules.save_error',
                defaultMessage: 'Failed to save access rules',
            }));
            return false;
        }
    }, [channel.id, expression, autoSyncMembers, formatMessage]);

    // Handle save changes panel actions
    const handleSaveChanges = useCallback(async () => {
        const success = await handleSave();
        if (!success) {
            setSaveChangesPanelState('error');
            return;
        }
        setSaveChangesPanelState('saved');
    }, [handleSave]);

    const handleCancel = useCallback(() => {
        // Reset to original values
        setExpression(originalExpression);
        setAutoSyncMembers(originalAutoSyncMembers);

        // Clear errors and panel state
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, [originalExpression, originalAutoSyncMembers]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
    }, []);

    // Calculate if there are errors
    const hasErrors = Boolean(formError) || Boolean(showTabSwitchError);

    // Calculate whether to show the save changes panel
    const shouldShowPanel = useMemo(() => {
        const unsavedChanges =
            expression !== originalExpression ||
            autoSyncMembers !== originalAutoSyncMembers;

        return unsavedChanges || saveChangesPanelState === 'saved';
    }, [expression, originalExpression, autoSyncMembers, originalAutoSyncMembers, saveChangesPanelState]);

    return (
        <div className='ChannelSettingsModal__accessRulesTab'>
            {/* Display system policies indicator if any are applied */}
            {!policiesLoading && systemPolicies.length > 0 && (
                <div className='ChannelSettingsModal__systemPolicies'>
                    <SystemPolicyIndicator
                        policies={systemPolicies}
                        resourceType='channel'
                        showPolicyNames={true}
                        variant='detailed'
                    />
                </div>
            )}

            <div className='ChannelSettingsModal__accessRulesHeader'>
                <h3 className='ChannelSettingsModal__accessRulesTitle'>
                    {formatMessage({id: 'channel_settings.access_rules.title', defaultMessage: 'Access Rules'})}
                </h3>
                <p className='ChannelSettingsModal__accessRulesSubtitle'>
                    {formatMessage({
                        id: 'channel_settings.access_rules.subtitle',
                        defaultMessage: 'Select user attributes and values as rules to restrict channel membership',
                    })}
                </p>
            </div>

            {/* TableEditor for creating access rules */}
            {attributesLoaded && (
                <div className='ChannelSettingsModal__accessRulesEditor'>
                    <TableEditor
                        value={expression}
                        onChange={handleExpressionChange}
                        onValidate={() => setFormError('')}
                        userAttributes={userAttributes}
                        onParseError={handleParseError}
                        actions={actions}
                        enableUserManagedAttributes={accessControlSettings?.EnableUserManagedAttributes || false}
                    />
                </div>
            )}

            <p className='ChannelSettingsModal__accessRulesDescription'>
                {formatMessage({
                    id: 'channel_settings.access_rules.description',
                    defaultMessage: 'Select attributes and values that users must match in addition to access this channel. All selected attributes are required.',
                })}
            </p>

            {/* Auto-sync members toggle */}
            <div className='ChannelSettingsModal__autoSyncSection'>
                <label className='ChannelSettingsModal__autoSyncLabel'>
                    <input
                        type='checkbox'
                        className='ChannelSettingsModal__autoSyncCheckbox'
                        checked={autoSyncMembers}
                        onChange={handleAutoSyncToggle}
                        id='autoSyncMembersCheckbox'
                        name='autoSyncMembers'
                    />
                    <span className='ChannelSettingsModal__autoSyncText'>
                        {formatMessage({
                            id: 'channel_settings.access_rules.auto_sync',
                            defaultMessage: 'Auto-add members based on access rules',
                        })}
                    </span>
                </label>
                <p className='ChannelSettingsModal__autoSyncDescription'>
                    {formatMessage({
                        id: 'channel_settings.access_rules.auto_sync_description',
                        defaultMessage: 'Users who match the configured attribute values will be automatically added as members',
                    })}
                </p>
            </div>

            {/* SaveChangesPanel for unsaved changes */}
            {shouldShowPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? 'error' : saveChangesPanelState}
                    customErrorMessage={formError || (showTabSwitchError ? undefined : formatMessage({
                        id: 'channel_settings.access_rules.form_error',
                        defaultMessage: 'There are errors in the form above',
                    }))}
                    cancelButtonText={formatMessage({
                        id: 'channel_settings.save_changes_panel.reset',
                        defaultMessage: 'Reset',
                    })}
                />
            )}
        </div>
    );
}

export default ChannelSettingsAccessRulesTab;
