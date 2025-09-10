// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import {getAccessControlSettings} from 'mattermost-redux/selectors/entities/access_control';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import ConfirmModal from 'components/confirm_modal';
import SystemPolicyIndicator from 'components/system_policy_indicator';
import SaveChangesPanel, {type SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import {useChannelSystemPolicies} from 'hooks/useChannelSystemPolicies';
import {JobTypes} from 'utils/constants';

import type {GlobalState} from 'types/store';

import ChannelAccessRulesConfirmModal from './channel_access_rules_confirm_modal';

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

    // Get access control settings and current user from Redux state
    const accessControlSettings = useSelector((state: GlobalState) => getAccessControlSettings(state));
    const currentUser = useSelector(getCurrentUser);

    // State for the access control expression and user attributes
    const [expression, setExpression] = useState('');
    const [originalExpression, setOriginalExpression] = useState('');
    const [userAttributes, setUserAttributes] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);

    // Auto-sync members toggle state
    const [autoSyncMembers, setAutoSyncMembers] = useState(false);
    const [originalAutoSyncMembers, setOriginalAutoSyncMembers] = useState(false);
    const [parentPolicyAutoSync, setParentPolicyAutoSync] = useState<boolean | null>(null);

    // SaveChangesPanel state
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [formError, setFormError] = useState('');

    // Validation modal state
    const [showSelfExclusionModal, setShowSelfExclusionModal] = useState(false);

    // Confirmation modal state
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [usersToAdd, setUsersToAdd] = useState<string[]>([]);
    const [usersToRemove, setUsersToRemove] = useState<string[]>([]);
    const [isProcessingSave, setIsProcessingSave] = useState(false);

    const actions = useChannelAccessControlActions();

    // Fetch system policies applied to this channel
    const {policies: systemPolicies, loading: policiesLoading} = useChannelSystemPolicies(channel);

    // Check if any parent policy has auto-sync enabled
    useEffect(() => {
        if (systemPolicies && systemPolicies.length > 0) {
            // Check if any parent policy has auto-sync enabled
            const hasParentAutoSyncEnabled = systemPolicies.some((policy) => policy.active === true);
            setParentPolicyAutoSync(hasParentAutoSyncEnabled);
        } else {
            setParentPolicyAutoSync(null);
        }
    }, [systemPolicies]);

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

    // Load existing channel access rules
    useEffect(() => {
        const loadChannelPolicy = async () => {
            try {
                const result = await actions.getChannelPolicy(channel.id);
                if (result.data) {
                    // Extract expression from the policy rules
                    const existingExpression = result.data.rules?.[0]?.expression || '';
                    let existingAutoSync = result.data.active || false;

                    // If parent policy has auto-sync enabled, force it to be enabled
                    if (parentPolicyAutoSync === true) {
                        existingAutoSync = true;
                    }

                    setExpression(existingExpression);
                    setOriginalExpression(existingExpression);
                    setAutoSyncMembers(existingAutoSync);
                    setOriginalAutoSyncMembers(existingAutoSync);
                }
            } catch (error) {
                // If no policy exists (404), that's fine - use defaults
                setExpression('');
                setOriginalExpression('');

                // If parent policy has auto-sync enabled, force it to be enabled
                const defaultAutoSync = parentPolicyAutoSync === true;
                setAutoSyncMembers(defaultAutoSync);
                setOriginalAutoSyncMembers(defaultAutoSync);
            }
        };

        loadChannelPolicy();
    }, [channel.id, actions, parentPolicyAutoSync]);

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
        // Don't allow toggling if no expression
        if (!expression.trim()) {
            return;
        }

        // If parent policy has auto-sync enabled, don't allow disabling
        if (parentPolicyAutoSync === true && autoSyncMembers) {
            // Trying to disable when any parent has it enabled - not allowed
            return;
        }

        setAutoSyncMembers((prev) => !prev);
    }, [parentPolicyAutoSync, expression, autoSyncMembers]);

    // Helper function to combine system policy expressions with channel expression
    const combineSystemAndChannelExpressions = useCallback((channelExpression: string): string => {
        // Get expressions from system policies
        const systemExpressions = systemPolicies.
            map((policy) => policy.rules?.[0]?.expression).
            filter((expr) => expr && expr.trim());

        // Combine channel expression with system expressions
        const allExpressions = [];

        // Add channel expression first (if it exists)
        if (channelExpression.trim()) {
            allExpressions.push(channelExpression.trim());
        }

        // Add system policy expressions
        if (systemExpressions.length > 0) {
            allExpressions.push(...systemExpressions);
        }

        // Combine with AND logic (same as sync job does)
        if (allExpressions.length === 0) {
            return '';
        } else if (allExpressions.length === 1) {
            return allExpressions[0];
        }

        // Wrap each expression in parentheses and combine with &&
        return allExpressions.
            map((expr) => `(${expr})`).
            join(' && ');
    }, [systemPolicies]);

    // Validate that current user satisfies the expression
    const validateSelfExclusion = useCallback(async (testExpression: string): Promise<boolean> => {
        if (!testExpression.trim()) {
            return true; // No expression, skip validation
        }

        if (!currentUser?.id) {
            return false;
        }

        try {
            const result = await actions.searchUsers(testExpression, '', '', 1000);
            if (!result.data || !result.data.users || result.data.users.length === 0) {
                // No users match the expression (including current user)
                setShowSelfExclusionModal(true);
                return false;
            }

            // Check if current user matches using efficient single iteration
            const currentUserMatches = result.data.users.some((u) => u.id === currentUser.id);
            if (!currentUserMatches) {
                // Current user would be excluded
                setShowSelfExclusionModal(true);
                return false;
            }

            return true;
        } catch (error) {
            // If validation fails, prevent save for security - don't risk self-exclusion
            // eslint-disable-next-line no-console
            console.error('Failed to validate self-exclusion:', error);
            setFormError(formatMessage({
                id: 'channel_settings.access_rules.error.validation_failed',
                defaultMessage: 'Failed to validate access rules. Please try again.',
            }));
            return false;
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]);

    // Calculate membership changes
    const calculateMembershipChanges = useCallback(async (channelExpression: string): Promise<{toAdd: string[]; toRemove: string[]}> => {
        // Combine system and channel expressions (same logic as sync job)
        const combinedExpression = combineSystemAndChannelExpressions(channelExpression);
        if (!combinedExpression.trim()) {
            return {toAdd: [], toRemove: []};
        }

        try {
            // Get users who match the COMBINED expression (system + channel)
            const matchResult = await actions.searchUsers(combinedExpression, '', '', 1000);
            const matchingUserIds = matchResult.data?.users.map((u) => u.id) || [];

            // Get current channel members
            const membersResult = await actions.getChannelMembers(channel.id);
            const currentMemberIds = membersResult.data?.map((m: any) => m.user_id) || [];

            // Calculate who will be added (if auto-sync is enabled)
            const toAdd = autoSyncMembers ?
                matchingUserIds.filter((id) => !currentMemberIds.includes(id)) :
                [];

            // Calculate who will be removed (users who don't match the expression)
            const toRemove = currentMemberIds.filter((id: string) => !matchingUserIds.includes(id));

            return {toAdd, toRemove};
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to calculate membership changes:', error);
            return {toAdd: [], toRemove: []};
        }
    }, [channel.id, autoSyncMembers, actions, combineSystemAndChannelExpressions]);

    // Perform the actual save
    const performSave = useCallback(async (): Promise<boolean> => {
        try {
            setIsProcessingSave(true);

            // Step 1: Build and save the policy object (without active field to avoid conflicts)
            const policy = {
                id: channel.id,
                name: channel.display_name,
                type: 'channel',
                version: 'v0.2',
                active: false, // Always save as false initially, then update separately
                revision: 1,
                created_at: Date.now(),
                rules: expression.trim() ? [{
                    actions: ['*'],
                    expression: expression.trim(),
                }] : [],
                imports: systemPolicies.map((p) => p.id), // Include existing parent policies
            };

            // Save the policy first
            const result = await actions.saveChannelPolicy(policy);
            if (result.error) {
                throw new Error(result.error.message || 'Failed to save policy');
            }

            // Step 2: Update the active status separately (like System Console does)
            try {
                await actions.updateAccessControlPolicyActive(channel.id, autoSyncMembers);
            } catch (activeError) {
                // eslint-disable-next-line no-console
                console.error('Failed to update policy active status:', activeError);

                // Don't fail the entire save operation for this, but log it
            }

            // Step 3: If auto-sync is enabled, create a job to immediately sync channel membership
            if (autoSyncMembers && expression.trim()) {
                try {
                    const job: JobTypeBase & { data: any } = {
                        type: JobTypes.ACCESS_CONTROL_SYNC,
                        data: {
                            parent_id: channel.id, // Sync only this specific channel policy
                        },
                    };
                    await actions.createJob(job);
                } catch (jobError) {
                    // Log job creation error but don't fail the save operation
                    // eslint-disable-next-line no-console
                    console.error('Failed to create access control sync job:', jobError);
                }
            }

            // Update original values on successful save
            setOriginalExpression(expression);
            setOriginalAutoSyncMembers(autoSyncMembers);

            // Close confirmation modal if open
            setShowConfirmModal(false);
            setUsersToAdd([]);
            setUsersToRemove([]);

            return true;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to save access rules:', error);
            setFormError(formatMessage({
                id: 'channel_settings.access_rules.save_error',
                defaultMessage: 'Failed to save access rules',
            }));
            return false;
        } finally {
            setIsProcessingSave(false);
        }
    }, [channel.id, channel.display_name, expression, autoSyncMembers, systemPolicies, actions, formatMessage, validateSelfExclusion]);

    // Handle save action
    const handleSave = useCallback(async (): Promise<'saved' | 'error' | 'confirmation_required'> => {
        try {
            // Validate expression if auto-sync is enabled
            if (autoSyncMembers && !expression.trim()) {
                setFormError(formatMessage({
                    id: 'channel_settings.access_rules.expression_required_for_autosync',
                    defaultMessage: 'Access rules are required when auto-add members is enabled',
                }));
                return 'error';
            }

            // Validate self-exclusion
            if (expression.trim()) {
                const isValid = await validateSelfExclusion(expression);
                if (!isValid) {
                    return 'error';
                }
            }

            // Calculate membership changes
            const changes = await calculateMembershipChanges(expression);

            // If there are changes, show confirmation modal
            if (changes.toAdd.length > 0 || changes.toRemove.length > 0) {
                setUsersToAdd(changes.toAdd);
                setUsersToRemove(changes.toRemove);
                setShowConfirmModal(true);
                return 'confirmation_required';
            }

            // No changes, save directly
            const success = await performSave();
            return success ? 'saved' : 'error';
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Failed to save access rules:', error);
            setFormError(formatMessage({
                id: 'channel_settings.access_rules.save_error',
                defaultMessage: 'Failed to save access rules',
            }));
            return 'error';
        }
    }, [expression, autoSyncMembers, formatMessage, validateSelfExclusion, calculateMembershipChanges, performSave]);

    // Handle confirmation modal confirm
    const handleConfirmSave = useCallback(async () => {
        const success = await performSave();
        if (success) {
            setSaveChangesPanelState('saved');
        } else {
            setSaveChangesPanelState('error');
        }
    }, [performSave]);

    // Handle save changes panel actions
    const handleSaveChanges = useCallback(async () => {
        const result = await handleSave();

        if (result === 'saved') {
            setSaveChangesPanelState('saved');
        } else if (result === 'error') {
            setSaveChangesPanelState('error');
        }

        // If result is 'confirmation_required', do nothing to the panel state
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
                <label
                    className='ChannelSettingsModal__autoSyncLabel'
                    title={(() => {
                        if (parentPolicyAutoSync === true) {
                            return formatMessage({
                                id: 'channel_settings.access_rules.auto_sync_forced_by_parent',
                                defaultMessage: 'Auto-add is enabled by system policy and cannot be disabled',
                            });
                        }
                        if (!expression.trim()) {
                            return formatMessage({
                                id: 'channel_settings.access_rules.auto_sync_requires_expression',
                                defaultMessage: 'Define access rules to enable auto-add members',
                            });
                        }
                        return undefined;
                    })()}
                >
                    <input
                        type='checkbox'
                        className='ChannelSettingsModal__autoSyncCheckbox'
                        checked={autoSyncMembers}
                        onChange={handleAutoSyncToggle}
                        disabled={(parentPolicyAutoSync === true && autoSyncMembers) || !expression.trim()}
                        id='autoSyncMembersCheckbox'
                        name='autoSyncMembers'
                    />
                    <span className={`ChannelSettingsModal__autoSyncText ${((parentPolicyAutoSync === true && autoSyncMembers) || !expression.trim()) ? 'disabled' : ''}`}>
                        {formatMessage({
                            id: 'channel_settings.access_rules.auto_sync',
                            defaultMessage: 'Auto-add members based on access rules',
                        })}
                    </span>
                </label>
                <p className='ChannelSettingsModal__autoSyncDescription'>
                    {(() => {
                        if (parentPolicyAutoSync === true) {
                            return formatMessage({
                                id: 'channel_settings.access_rules.auto_sync_forced_description',
                                defaultMessage: 'Auto-add is enabled by system policy. Users who match the configured attribute values will be automatically added as members and those who no longer match will be removed.',
                            });
                        }
                        if (!expression.trim()) {
                            return formatMessage({
                                id: 'channel_settings.access_rules.auto_sync_no_rules_description',
                                defaultMessage: 'Define access rules above to enable automatic member synchronization.',
                            });
                        }
                        if (autoSyncMembers) {
                            return formatMessage({
                                id: 'channel_settings.access_rules.auto_sync_enabled_description',
                                defaultMessage: 'Users who match the configured attribute values will be automatically added as members and those who no longer match will be removed.',
                            });
                        }
                        return formatMessage({
                            id: 'channel_settings.access_rules.auto_sync_disabled_description',
                            defaultMessage: 'Access rules will prevent unauthorized users from joining, but will not automatically add qualifying members.',
                        });
                    })()}
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

            {/* Self-exclusion error modal */}
            <ConfirmModal
                show={showSelfExclusionModal}
                title={
                    <FormattedMessage
                        id='channel_settings.access_rules.error.self_exclusion_title'
                        defaultMessage='Cannot save access rules'
                    />
                }
                message={
                    <FormattedMessage
                        id='channel_settings.access_rules.error.self_exclusion_message'
                        defaultMessage="You cannot set this rule because it would remove you from the channel. Please update the access rules to make sure you satisfy them and they don't cause any unintended issues."
                    />
                }
                confirmButtonText={
                    <FormattedMessage
                        id='channel_settings.access_rules.error.back_to_editing'
                        defaultMessage='Back to editing'
                    />
                }
                onConfirm={() => setShowSelfExclusionModal(false)}
                hideCancel={true}
                confirmButtonClass='btn btn-primary'
            />

            {/* Confirmation modal for membership changes */}
            <ChannelAccessRulesConfirmModal
                show={showConfirmModal}
                onHide={() => {
                    setShowConfirmModal(false);
                    setUsersToAdd([]);
                    setUsersToRemove([]);

                    // Clear any error state when canceling the modal
                    if (saveChangesPanelState === 'error') {
                        setSaveChangesPanelState(undefined);
                    }
                }}
                onConfirm={handleConfirmSave}
                channelName={channel.display_name}
                usersToAdd={usersToAdd}
                usersToRemove={usersToRemove}
                isProcessing={isProcessingSave}
                autoSyncEnabled={autoSyncMembers}
            />
        </div>
    );
}

export default ChannelSettingsAccessRulesTab;
