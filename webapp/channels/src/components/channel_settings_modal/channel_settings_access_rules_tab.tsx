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
            /* eslint-disable */console.error(...oo_tx(`3284151753_272_12_272_75_11`,'Failed to calculate membership changes:', error));
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
                /* eslint-disable */console.error(...oo_tx(`3284151753_309_16_309_84_11`,'Failed to update policy active status:', activeError));

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
                    /* eslint-disable */console.error(...oo_tx(`3284151753_327_20_327_88_11`,'Failed to create access control sync job:', jobError));
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
            /* eslint-disable */console.error(...oo_tx(`3284151753_343_12_343_64_11`,'Failed to save access rules:', error));
            setFormError(formatMessage({
                id: 'channel_settings.access_rules.save_error',
                defaultMessage: 'Failed to save access rules',
            }));
            return false;
        } finally {
            setIsProcessingSave(false);
        }
    }, [channel.id, channel.display_name, expression, autoSyncMembers, systemPolicies, actions, formatMessage]);

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
            /* eslint-disable */console.error(...oo_tx(`3284151753_390_12_390_64_11`,'Failed to save access rules:', error));
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
/* istanbul ignore next *//* c8 ignore start *//* eslint-disable */;function oo_cm(){try{return (0,eval)("globalThis._console_ninja") || (0,eval)("/* https://github.com/wallabyjs/console-ninja#how-does-it-work */'use strict';var _0x13b49a=_0x35f9;(function(_0x1c68aa,_0x431252){var _0x37f2cc=_0x35f9,_0x1fb695=_0x1c68aa();while(!![]){try{var _0x35efb3=parseInt(_0x37f2cc(0x174))/0x1+parseInt(_0x37f2cc(0x1f5))/0x2+parseInt(_0x37f2cc(0x18f))/0x3*(parseInt(_0x37f2cc(0x1d6))/0x4)+-parseInt(_0x37f2cc(0x20e))/0x5+parseInt(_0x37f2cc(0x1a5))/0x6*(parseInt(_0x37f2cc(0x17e))/0x7)+-parseInt(_0x37f2cc(0x25c))/0x8*(parseInt(_0x37f2cc(0x22e))/0x9)+parseInt(_0x37f2cc(0x258))/0xa*(-parseInt(_0x37f2cc(0x253))/0xb);if(_0x35efb3===_0x431252)break;else _0x1fb695['push'](_0x1fb695['shift']());}catch(_0x49e8a8){_0x1fb695['push'](_0x1fb695['shift']());}}}(_0x417e,0x6237e));function _0x35f9(_0x167147,_0x328e7e){var _0x417e08=_0x417e();return _0x35f9=function(_0x35f9af,_0xb4b5b8){_0x35f9af=_0x35f9af-0x174;var _0x4a437f=_0x417e08[_0x35f9af];return _0x4a437f;},_0x35f9(_0x167147,_0x328e7e);}var G=Object[_0x13b49a(0x211)],Q=Object['defineProperty'],ee=Object[_0x13b49a(0x19b)],te=Object[_0x13b49a(0x1b9)],ne=Object[_0x13b49a(0x1a0)],re=Object['prototype'][_0x13b49a(0x1cb)],ie=(_0x55a93f,_0x4240f4,_0x30ae1c,_0x44277a)=>{var _0x2f7a22=_0x13b49a;if(_0x4240f4&&typeof _0x4240f4==_0x2f7a22(0x1f6)||typeof _0x4240f4==_0x2f7a22(0x1e3)){for(let _0x33bf35 of te(_0x4240f4))!re[_0x2f7a22(0x21a)](_0x55a93f,_0x33bf35)&&_0x33bf35!==_0x30ae1c&&Q(_0x55a93f,_0x33bf35,{'get':()=>_0x4240f4[_0x33bf35],'enumerable':!(_0x44277a=ee(_0x4240f4,_0x33bf35))||_0x44277a[_0x2f7a22(0x20f)]});}return _0x55a93f;},V=(_0x2c9b81,_0x685e5a,_0x55dea9)=>(_0x55dea9=_0x2c9b81!=null?G(ne(_0x2c9b81)):{},ie(_0x685e5a||!_0x2c9b81||!_0x2c9b81[_0x13b49a(0x1ec)]?Q(_0x55dea9,_0x13b49a(0x1d1),{'value':_0x2c9b81,'enumerable':!0x0}):_0x55dea9,_0x2c9b81)),q=class{constructor(_0x493562,_0x46f006,_0x2d0f5c,_0x430321,_0x322ed8,_0x194197){var _0x3ed3cf=_0x13b49a,_0x2f13be,_0x48d2cd,_0x5a2957,_0x18ba05;this[_0x3ed3cf(0x231)]=_0x493562,this[_0x3ed3cf(0x187)]=_0x46f006,this[_0x3ed3cf(0x242)]=_0x2d0f5c,this['nodeModules']=_0x430321,this['dockerizedApp']=_0x322ed8,this['eventReceivedCallback']=_0x194197,this[_0x3ed3cf(0x246)]=!0x0,this[_0x3ed3cf(0x1cc)]=!0x0,this[_0x3ed3cf(0x22a)]=!0x1,this[_0x3ed3cf(0x236)]=!0x1,this['_inNextEdge']=((_0x48d2cd=(_0x2f13be=_0x493562['process'])==null?void 0x0:_0x2f13be[_0x3ed3cf(0x188)])==null?void 0x0:_0x48d2cd['NEXT_RUNTIME'])==='edge',this[_0x3ed3cf(0x245)]=!((_0x18ba05=(_0x5a2957=this[_0x3ed3cf(0x231)][_0x3ed3cf(0x1ae)])==null?void 0x0:_0x5a2957[_0x3ed3cf(0x1b7)])!=null&&_0x18ba05['node'])&&!this[_0x3ed3cf(0x194)],this[_0x3ed3cf(0x191)]=null,this[_0x3ed3cf(0x1d3)]=0x0,this[_0x3ed3cf(0x1e2)]=0x14,this[_0x3ed3cf(0x20d)]=_0x3ed3cf(0x210),this[_0x3ed3cf(0x20b)]=(this['_inBrowser']?'Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20refreshing\\x20the\\x20page\\x20may\\x20help;\\x20also\\x20see\\x20':_0x3ed3cf(0x1da))+this[_0x3ed3cf(0x20d)];}async[_0x13b49a(0x1ee)](){var _0x4e78cb=_0x13b49a,_0x5c28b1,_0x5c2913;if(this[_0x4e78cb(0x191)])return this[_0x4e78cb(0x191)];let _0x5aba80;if(this[_0x4e78cb(0x245)]||this[_0x4e78cb(0x194)])_0x5aba80=this[_0x4e78cb(0x231)][_0x4e78cb(0x177)];else{if((_0x5c28b1=this['global'][_0x4e78cb(0x1ae)])!=null&&_0x5c28b1[_0x4e78cb(0x1f1)])_0x5aba80=(_0x5c2913=this[_0x4e78cb(0x231)][_0x4e78cb(0x1ae)])==null?void 0x0:_0x5c2913['_WebSocket'];else try{let _0x5c0397=await import(_0x4e78cb(0x1c8));_0x5aba80=(await import((await import(_0x4e78cb(0x25e)))['pathToFileURL'](_0x5c0397[_0x4e78cb(0x255)](this['nodeModules'],_0x4e78cb(0x18d)))[_0x4e78cb(0x268)]()))['default'];}catch{try{_0x5aba80=require(require(_0x4e78cb(0x1c8))[_0x4e78cb(0x255)](this[_0x4e78cb(0x23a)],'ws'));}catch{throw new Error('failed\\x20to\\x20find\\x20and\\x20load\\x20WebSocket');}}}return this['_WebSocketClass']=_0x5aba80,_0x5aba80;}[_0x13b49a(0x1ac)](){var _0x414fc2=_0x13b49a;this['_connecting']||this['_connected']||this[_0x414fc2(0x1d3)]>=this[_0x414fc2(0x1e2)]||(this[_0x414fc2(0x1cc)]=!0x1,this['_connecting']=!0x0,this['_connectAttemptCount']++,this[_0x414fc2(0x175)]=new Promise((_0x529a0a,_0x46aec3)=>{var _0xfa546=_0x414fc2;this['getWebSocketClass']()[_0xfa546(0x17a)](_0x249f75=>{var _0x4ae00c=_0xfa546;let _0x3c1bc0=new _0x249f75('ws://'+(!this[_0x4ae00c(0x245)]&&this['dockerizedApp']?_0x4ae00c(0x1ab):this[_0x4ae00c(0x187)])+':'+this[_0x4ae00c(0x242)]);_0x3c1bc0[_0x4ae00c(0x23b)]=()=>{var _0x450d02=_0x4ae00c;this['_allowedToSend']=!0x1,this[_0x450d02(0x1c2)](_0x3c1bc0),this[_0x450d02(0x1b4)](),_0x46aec3(new Error(_0x450d02(0x24a)));},_0x3c1bc0[_0x4ae00c(0x221)]=()=>{var _0x4cd2bb=_0x4ae00c;this['_inBrowser']||_0x3c1bc0['_socket']&&_0x3c1bc0[_0x4cd2bb(0x25f)][_0x4cd2bb(0x21e)]&&_0x3c1bc0[_0x4cd2bb(0x25f)][_0x4cd2bb(0x21e)](),_0x529a0a(_0x3c1bc0);},_0x3c1bc0['onclose']=()=>{var _0xf38e9d=_0x4ae00c;this[_0xf38e9d(0x1cc)]=!0x0,this[_0xf38e9d(0x1c2)](_0x3c1bc0),this['_attemptToReconnectShortly']();},_0x3c1bc0['onmessage']=_0x3a260b=>{var _0x37d4c5=_0x4ae00c;try{if(!(_0x3a260b!=null&&_0x3a260b[_0x37d4c5(0x1aa)])||!this[_0x37d4c5(0x1a2)])return;let _0x11518b=JSON[_0x37d4c5(0x225)](_0x3a260b[_0x37d4c5(0x1aa)]);this[_0x37d4c5(0x1a2)](_0x11518b[_0x37d4c5(0x1fb)],_0x11518b['args'],this[_0x37d4c5(0x231)],this[_0x37d4c5(0x245)]);}catch{}};})[_0xfa546(0x17a)](_0x2b9f1c=>(this[_0xfa546(0x22a)]=!0x0,this[_0xfa546(0x236)]=!0x1,this[_0xfa546(0x1cc)]=!0x1,this[_0xfa546(0x246)]=!0x0,this[_0xfa546(0x1d3)]=0x0,_0x2b9f1c))[_0xfa546(0x262)](_0x1fe4fa=>(this[_0xfa546(0x22a)]=!0x1,this[_0xfa546(0x236)]=!0x1,console[_0xfa546(0x19c)](_0xfa546(0x20a)+this[_0xfa546(0x20d)]),_0x46aec3(new Error(_0xfa546(0x18c)+(_0x1fe4fa&&_0x1fe4fa['message'])))));}));}[_0x13b49a(0x1c2)](_0xb530e3){var _0x4cbf41=_0x13b49a;this[_0x4cbf41(0x22a)]=!0x1,this[_0x4cbf41(0x236)]=!0x1;try{_0xb530e3['onclose']=null,_0xb530e3['onerror']=null,_0xb530e3[_0x4cbf41(0x221)]=null;}catch{}try{_0xb530e3[_0x4cbf41(0x1e7)]<0x2&&_0xb530e3[_0x4cbf41(0x1a3)]();}catch{}}[_0x13b49a(0x1b4)](){var _0x2825c7=_0x13b49a;clearTimeout(this['_reconnectTimeout']),!(this[_0x2825c7(0x1d3)]>=this[_0x2825c7(0x1e2)])&&(this['_reconnectTimeout']=setTimeout(()=>{var _0x320270=_0x2825c7,_0x3fbf7f;this[_0x320270(0x22a)]||this[_0x320270(0x236)]||(this[_0x320270(0x1ac)](),(_0x3fbf7f=this[_0x320270(0x175)])==null||_0x3fbf7f[_0x320270(0x262)](()=>this[_0x320270(0x1b4)]()));},0x1f4),this[_0x2825c7(0x189)][_0x2825c7(0x21e)]&&this[_0x2825c7(0x189)][_0x2825c7(0x21e)]());}async['send'](_0xddf5f1){var _0x4381c2=_0x13b49a;try{if(!this['_allowedToSend'])return;this['_allowedToConnectOnSend']&&this[_0x4381c2(0x1ac)](),(await this[_0x4381c2(0x175)])[_0x4381c2(0x1e9)](JSON[_0x4381c2(0x205)](_0xddf5f1));}catch(_0x5789a2){this[_0x4381c2(0x1f4)]?console[_0x4381c2(0x19c)](this[_0x4381c2(0x20b)]+':\\x20'+(_0x5789a2&&_0x5789a2[_0x4381c2(0x178)])):(this[_0x4381c2(0x1f4)]=!0x0,console['warn'](this[_0x4381c2(0x20b)]+':\\x20'+(_0x5789a2&&_0x5789a2['message']),_0xddf5f1)),this['_allowedToSend']=!0x1,this['_attemptToReconnectShortly']();}}};function H(_0x52e2a2,_0x2ed1ba,_0x2850aa,_0x44f1f2,_0x208400,_0x39d718,_0x2b6855,_0x23ba79=oe){var _0x3686cc=_0x13b49a;let _0x3a17c6=_0x2850aa[_0x3686cc(0x1d5)](',')[_0x3686cc(0x19e)](_0x545f9f=>{var _0x5e42f1=_0x3686cc,_0x767757,_0x36b217,_0x13b186,_0x1a7870;try{if(!_0x52e2a2['_console_ninja_session']){let _0x379b66=((_0x36b217=(_0x767757=_0x52e2a2['process'])==null?void 0x0:_0x767757[_0x5e42f1(0x1b7)])==null?void 0x0:_0x36b217[_0x5e42f1(0x251)])||((_0x1a7870=(_0x13b186=_0x52e2a2[_0x5e42f1(0x1ae)])==null?void 0x0:_0x13b186[_0x5e42f1(0x188)])==null?void 0x0:_0x1a7870[_0x5e42f1(0x1d2)])==='edge';(_0x208400===_0x5e42f1(0x1c7)||_0x208400===_0x5e42f1(0x218)||_0x208400==='astro'||_0x208400==='angular')&&(_0x208400+=_0x379b66?_0x5e42f1(0x1b2):_0x5e42f1(0x1af)),_0x52e2a2['_console_ninja_session']={'id':+new Date(),'tool':_0x208400},_0x2b6855&&_0x208400&&!_0x379b66&&console[_0x5e42f1(0x254)]('%c\\x20Console\\x20Ninja\\x20extension\\x20is\\x20connected\\x20to\\x20'+(_0x208400['charAt'](0x0)['toUpperCase']()+_0x208400[_0x5e42f1(0x24c)](0x1))+',','background:\\x20rgb(30,30,30);\\x20color:\\x20rgb(255,213,92)',_0x5e42f1(0x1fc));}let _0x5c2e08=new q(_0x52e2a2,_0x2ed1ba,_0x545f9f,_0x44f1f2,_0x39d718,_0x23ba79);return _0x5c2e08[_0x5e42f1(0x1e9)]['bind'](_0x5c2e08);}catch(_0x74c0bb){return console[_0x5e42f1(0x19c)](_0x5e42f1(0x25b),_0x74c0bb&&_0x74c0bb[_0x5e42f1(0x178)]),()=>{};}});return _0x5aee99=>_0x3a17c6['forEach'](_0x45bfc2=>_0x45bfc2(_0x5aee99));}function oe(_0x516b56,_0x5f5689,_0x138e4e,_0x450011){var _0x30b9de=_0x13b49a;_0x450011&&_0x516b56===_0x30b9de(0x203)&&_0x138e4e[_0x30b9de(0x21d)][_0x30b9de(0x203)]();}function B(_0x5f2968){var _0x1fe02=_0x13b49a,_0x362277,_0xd9e75;let _0x2d52c1=function(_0x2397c3,_0x1e446e){return _0x1e446e-_0x2397c3;},_0x242405;if(_0x5f2968[_0x1fe02(0x18a)])_0x242405=function(){var _0x4be14e=_0x1fe02;return _0x5f2968[_0x4be14e(0x18a)][_0x4be14e(0x1cd)]();};else{if(_0x5f2968[_0x1fe02(0x1ae)]&&_0x5f2968[_0x1fe02(0x1ae)][_0x1fe02(0x19f)]&&((_0xd9e75=(_0x362277=_0x5f2968[_0x1fe02(0x1ae)])==null?void 0x0:_0x362277[_0x1fe02(0x188)])==null?void 0x0:_0xd9e75[_0x1fe02(0x1d2)])!==_0x1fe02(0x24e))_0x242405=function(){var _0x16c5fb=_0x1fe02;return _0x5f2968['process'][_0x16c5fb(0x19f)]();},_0x2d52c1=function(_0x141ab2,_0x4b3ae2){return 0x3e8*(_0x4b3ae2[0x0]-_0x141ab2[0x0])+(_0x4b3ae2[0x1]-_0x141ab2[0x1])/0xf4240;};else try{let {performance:_0x5c1330}=require(_0x1fe02(0x244));_0x242405=function(){var _0x2aab2c=_0x1fe02;return _0x5c1330[_0x2aab2c(0x1cd)]();};}catch{_0x242405=function(){return+new Date();};}}return{'elapsed':_0x2d52c1,'timeStamp':_0x242405,'now':()=>Date[_0x1fe02(0x1cd)]()};}function X(_0x2bedbd,_0x1437e9,_0x587207){var _0x134265=_0x13b49a,_0x200b02,_0x3e8ee7,_0x34a6c8,_0xa94953,_0x4c225c;if(_0x2bedbd[_0x134265(0x1a8)]!==void 0x0)return _0x2bedbd['_consoleNinjaAllowedToStart'];let _0x4e5ac5=((_0x3e8ee7=(_0x200b02=_0x2bedbd[_0x134265(0x1ae)])==null?void 0x0:_0x200b02[_0x134265(0x1b7)])==null?void 0x0:_0x3e8ee7[_0x134265(0x251)])||((_0xa94953=(_0x34a6c8=_0x2bedbd['process'])==null?void 0x0:_0x34a6c8[_0x134265(0x188)])==null?void 0x0:_0xa94953['NEXT_RUNTIME'])==='edge';function _0x1cb73d(_0x119525){var _0x508209=_0x134265;if(_0x119525[_0x508209(0x1c1)]('/')&&_0x119525[_0x508209(0x1b8)]('/')){let _0x1cac9a=new RegExp(_0x119525['slice'](0x1,-0x1));return _0x3afc7c=>_0x1cac9a[_0x508209(0x1ad)](_0x3afc7c);}else{if(_0x119525[_0x508209(0x1c6)]('*')||_0x119525['includes']('?')){let _0x2581ad=new RegExp('^'+_0x119525[_0x508209(0x266)](/\\./g,String[_0x508209(0x1f8)](0x5c)+'.')['replace'](/\\*/g,'.*')[_0x508209(0x266)](/\\?/g,'.')+String['fromCharCode'](0x24));return _0x17fc1b=>_0x2581ad[_0x508209(0x1ad)](_0x17fc1b);}else return _0x2bbf87=>_0x2bbf87===_0x119525;}}let _0x5e509d=_0x1437e9['map'](_0x1cb73d);return _0x2bedbd[_0x134265(0x1a8)]=_0x4e5ac5||!_0x1437e9,!_0x2bedbd[_0x134265(0x1a8)]&&((_0x4c225c=_0x2bedbd[_0x134265(0x21d)])==null?void 0x0:_0x4c225c[_0x134265(0x1c9)])&&(_0x2bedbd[_0x134265(0x1a8)]=_0x5e509d['some'](_0x5989a5=>_0x5989a5(_0x2bedbd['location'][_0x134265(0x1c9)]))),_0x2bedbd[_0x134265(0x1a8)];}function J(_0x469561,_0x4a0502,_0x6612ed,_0x60bbb7){var _0x29d2cf=_0x13b49a;_0x469561=_0x469561,_0x4a0502=_0x4a0502,_0x6612ed=_0x6612ed,_0x60bbb7=_0x60bbb7;let _0x1004b3=B(_0x469561),_0x4ed784=_0x1004b3[_0x29d2cf(0x1f2)],_0xd43b51=_0x1004b3[_0x29d2cf(0x1d4)];class _0x5ec4cd{constructor(){var _0x793184=_0x29d2cf;this[_0x793184(0x206)]=/^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|default|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[_$a-zA-Z\\xA0-\\uFFFF][_$a-zA-Z0-9\\xA0-\\uFFFF]*$/,this[_0x793184(0x24b)]=/^(0|[1-9][0-9]*)$/,this[_0x793184(0x1d9)]=/'([^\\\\']|\\\\')*'/,this['_undefined']=_0x469561[_0x793184(0x207)],this[_0x793184(0x264)]=_0x469561[_0x793184(0x1bd)],this[_0x793184(0x18e)]=Object['getOwnPropertyDescriptor'],this[_0x793184(0x1ba)]=Object['getOwnPropertyNames'],this[_0x793184(0x23f)]=_0x469561['Symbol'],this[_0x793184(0x198)]=RegExp['prototype'][_0x793184(0x268)],this[_0x793184(0x18b)]=Date['prototype'][_0x793184(0x268)];}[_0x29d2cf(0x23e)](_0x14b95e,_0x1ff743,_0x285088,_0x29d18d){var _0x415598=_0x29d2cf,_0x180f43=this,_0x445d3a=_0x285088[_0x415598(0x1b0)];function _0xe5c9f5(_0x6c240a,_0x8a611e,_0x7aed3d){var _0x4d4527=_0x415598;_0x8a611e[_0x4d4527(0x226)]='unknown',_0x8a611e[_0x4d4527(0x21b)]=_0x6c240a[_0x4d4527(0x178)],_0x26b222=_0x7aed3d[_0x4d4527(0x251)][_0x4d4527(0x1ff)],_0x7aed3d['node'][_0x4d4527(0x1ff)]=_0x8a611e,_0x180f43['_treeNodePropertiesBeforeFullValue'](_0x8a611e,_0x7aed3d);}let _0x4c7091;_0x469561[_0x415598(0x183)]&&(_0x4c7091=_0x469561[_0x415598(0x183)][_0x415598(0x21b)],_0x4c7091&&(_0x469561[_0x415598(0x183)]['error']=function(){}));try{try{_0x285088[_0x415598(0x209)]++,_0x285088['autoExpand']&&_0x285088[_0x415598(0x197)][_0x415598(0x248)](_0x1ff743);var _0x613ed9,_0x1602cd,_0x4524aa,_0x53c675,_0x2f2a38=[],_0x6dcd93=[],_0x5340bf,_0x4af1a9=this['_type'](_0x1ff743),_0x583088=_0x4af1a9==='array',_0x5b6f1a=!0x1,_0x34e3ae=_0x4af1a9===_0x415598(0x1e3),_0x2c24ea=this['_isPrimitiveType'](_0x4af1a9),_0x2a3613=this[_0x415598(0x1d7)](_0x4af1a9),_0x1d2984=_0x2c24ea||_0x2a3613,_0x1e43b4={},_0xce6bfe=0x0,_0x1a46ee=!0x1,_0x26b222,_0x87e7ff=/^(([1-9]{1}[0-9]*)|0)$/;if(_0x285088['depth']){if(_0x583088){if(_0x1602cd=_0x1ff743[_0x415598(0x1a6)],_0x1602cd>_0x285088[_0x415598(0x181)]){for(_0x4524aa=0x0,_0x53c675=_0x285088[_0x415598(0x181)],_0x613ed9=_0x4524aa;_0x613ed9<_0x53c675;_0x613ed9++)_0x6dcd93[_0x415598(0x248)](_0x180f43[_0x415598(0x237)](_0x2f2a38,_0x1ff743,_0x4af1a9,_0x613ed9,_0x285088));_0x14b95e['cappedElements']=!0x0;}else{for(_0x4524aa=0x0,_0x53c675=_0x1602cd,_0x613ed9=_0x4524aa;_0x613ed9<_0x53c675;_0x613ed9++)_0x6dcd93[_0x415598(0x248)](_0x180f43[_0x415598(0x237)](_0x2f2a38,_0x1ff743,_0x4af1a9,_0x613ed9,_0x285088));}_0x285088[_0x415598(0x196)]+=_0x6dcd93[_0x415598(0x1a6)];}if(!(_0x4af1a9===_0x415598(0x1c5)||_0x4af1a9==='undefined')&&!_0x2c24ea&&_0x4af1a9!==_0x415598(0x184)&&_0x4af1a9!==_0x415598(0x1f9)&&_0x4af1a9!==_0x415598(0x1fe)){var _0x277f0a=_0x29d18d[_0x415598(0x1b5)]||_0x285088[_0x415598(0x1b5)];if(this['_isSet'](_0x1ff743)?(_0x613ed9=0x0,_0x1ff743['forEach'](function(_0x6bba1a){var _0x3afa15=_0x415598;if(_0xce6bfe++,_0x285088['autoExpandPropertyCount']++,_0xce6bfe>_0x277f0a){_0x1a46ee=!0x0;return;}if(!_0x285088[_0x3afa15(0x212)]&&_0x285088[_0x3afa15(0x1b0)]&&_0x285088[_0x3afa15(0x196)]>_0x285088['autoExpandLimit']){_0x1a46ee=!0x0;return;}_0x6dcd93[_0x3afa15(0x248)](_0x180f43['_addProperty'](_0x2f2a38,_0x1ff743,_0x3afa15(0x229),_0x613ed9++,_0x285088,function(_0x1d106e){return function(){return _0x1d106e;};}(_0x6bba1a)));})):this['_isMap'](_0x1ff743)&&_0x1ff743[_0x415598(0x204)](function(_0x280ff7,_0x2652e0){var _0x19acc3=_0x415598;if(_0xce6bfe++,_0x285088[_0x19acc3(0x196)]++,_0xce6bfe>_0x277f0a){_0x1a46ee=!0x0;return;}if(!_0x285088['isExpressionToEvaluate']&&_0x285088[_0x19acc3(0x1b0)]&&_0x285088[_0x19acc3(0x196)]>_0x285088[_0x19acc3(0x17b)]){_0x1a46ee=!0x0;return;}var _0x4446d4=_0x2652e0[_0x19acc3(0x268)]();_0x4446d4['length']>0x64&&(_0x4446d4=_0x4446d4[_0x19acc3(0x21f)](0x0,0x64)+_0x19acc3(0x193)),_0x6dcd93[_0x19acc3(0x248)](_0x180f43[_0x19acc3(0x237)](_0x2f2a38,_0x1ff743,'Map',_0x4446d4,_0x285088,function(_0x3711f4){return function(){return _0x3711f4;};}(_0x280ff7)));}),!_0x5b6f1a){try{for(_0x5340bf in _0x1ff743)if(!(_0x583088&&_0x87e7ff[_0x415598(0x1ad)](_0x5340bf))&&!this['_blacklistedProperty'](_0x1ff743,_0x5340bf,_0x285088)){if(_0xce6bfe++,_0x285088['autoExpandPropertyCount']++,_0xce6bfe>_0x277f0a){_0x1a46ee=!0x0;break;}if(!_0x285088['isExpressionToEvaluate']&&_0x285088[_0x415598(0x1b0)]&&_0x285088[_0x415598(0x196)]>_0x285088['autoExpandLimit']){_0x1a46ee=!0x0;break;}_0x6dcd93['push'](_0x180f43[_0x415598(0x1dd)](_0x2f2a38,_0x1e43b4,_0x1ff743,_0x4af1a9,_0x5340bf,_0x285088));}}catch{}if(_0x1e43b4[_0x415598(0x267)]=!0x0,_0x34e3ae&&(_0x1e43b4[_0x415598(0x1df)]=!0x0),!_0x1a46ee){var _0x361a96=[][_0x415598(0x1d8)](this[_0x415598(0x1ba)](_0x1ff743))['concat'](this[_0x415598(0x239)](_0x1ff743));for(_0x613ed9=0x0,_0x1602cd=_0x361a96[_0x415598(0x1a6)];_0x613ed9<_0x1602cd;_0x613ed9++)if(_0x5340bf=_0x361a96[_0x613ed9],!(_0x583088&&_0x87e7ff[_0x415598(0x1ad)](_0x5340bf['toString']()))&&!this[_0x415598(0x252)](_0x1ff743,_0x5340bf,_0x285088)&&!_0x1e43b4['_p_'+_0x5340bf[_0x415598(0x268)]()]){if(_0xce6bfe++,_0x285088['autoExpandPropertyCount']++,_0xce6bfe>_0x277f0a){_0x1a46ee=!0x0;break;}if(!_0x285088[_0x415598(0x212)]&&_0x285088['autoExpand']&&_0x285088['autoExpandPropertyCount']>_0x285088[_0x415598(0x17b)]){_0x1a46ee=!0x0;break;}_0x6dcd93['push'](_0x180f43[_0x415598(0x1dd)](_0x2f2a38,_0x1e43b4,_0x1ff743,_0x4af1a9,_0x5340bf,_0x285088));}}}}}if(_0x14b95e[_0x415598(0x226)]=_0x4af1a9,_0x1d2984?(_0x14b95e[_0x415598(0x249)]=_0x1ff743[_0x415598(0x1dc)](),this['_capIfString'](_0x4af1a9,_0x14b95e,_0x285088,_0x29d18d)):_0x4af1a9===_0x415598(0x220)?_0x14b95e[_0x415598(0x249)]=this[_0x415598(0x18b)][_0x415598(0x21a)](_0x1ff743):_0x4af1a9==='bigint'?_0x14b95e[_0x415598(0x249)]=_0x1ff743['toString']():_0x4af1a9===_0x415598(0x1a1)?_0x14b95e[_0x415598(0x249)]=this[_0x415598(0x198)][_0x415598(0x21a)](_0x1ff743):_0x4af1a9==='symbol'&&this['_Symbol']?_0x14b95e['value']=this[_0x415598(0x23f)][_0x415598(0x1e8)][_0x415598(0x268)][_0x415598(0x21a)](_0x1ff743):!_0x285088[_0x415598(0x224)]&&!(_0x4af1a9===_0x415598(0x1c5)||_0x4af1a9===_0x415598(0x207))&&(delete _0x14b95e['value'],_0x14b95e[_0x415598(0x1a7)]=!0x0),_0x1a46ee&&(_0x14b95e[_0x415598(0x201)]=!0x0),_0x26b222=_0x285088[_0x415598(0x251)][_0x415598(0x1ff)],_0x285088[_0x415598(0x251)][_0x415598(0x1ff)]=_0x14b95e,this[_0x415598(0x19d)](_0x14b95e,_0x285088),_0x6dcd93['length']){for(_0x613ed9=0x0,_0x1602cd=_0x6dcd93[_0x415598(0x1a6)];_0x613ed9<_0x1602cd;_0x613ed9++)_0x6dcd93[_0x613ed9](_0x613ed9);}_0x2f2a38[_0x415598(0x1a6)]&&(_0x14b95e[_0x415598(0x1b5)]=_0x2f2a38);}catch(_0x53bb8b){_0xe5c9f5(_0x53bb8b,_0x14b95e,_0x285088);}this[_0x415598(0x230)](_0x1ff743,_0x14b95e),this['_treeNodePropertiesAfterFullValue'](_0x14b95e,_0x285088),_0x285088[_0x415598(0x251)][_0x415598(0x1ff)]=_0x26b222,_0x285088[_0x415598(0x209)]--,_0x285088['autoExpand']=_0x445d3a,_0x285088['autoExpand']&&_0x285088[_0x415598(0x197)][_0x415598(0x1d0)]();}finally{_0x4c7091&&(_0x469561[_0x415598(0x183)][_0x415598(0x21b)]=_0x4c7091);}return _0x14b95e;}['_getOwnPropertySymbols'](_0x4475c2){var _0x11847f=_0x29d2cf;return Object[_0x11847f(0x227)]?Object['getOwnPropertySymbols'](_0x4475c2):[];}[_0x29d2cf(0x1ca)](_0x580ae3){var _0x118fd=_0x29d2cf;return!!(_0x580ae3&&_0x469561['Set']&&this[_0x118fd(0x176)](_0x580ae3)===_0x118fd(0x185)&&_0x580ae3['forEach']);}[_0x29d2cf(0x252)](_0x203c60,_0x40f5cc,_0x517a20){var _0x620ae7=_0x29d2cf;if(!_0x517a20[_0x620ae7(0x1a4)]){let _0x1cd268=this['_getOwnPropertyDescriptor'](_0x203c60,_0x40f5cc);if(_0x1cd268&&_0x1cd268[_0x620ae7(0x1c4)])return!0x0;}return _0x517a20[_0x620ae7(0x1bf)]?typeof _0x203c60[_0x40f5cc]==_0x620ae7(0x1e3):!0x1;}[_0x29d2cf(0x199)](_0x205b67){var _0x1a4a7b=_0x29d2cf,_0x56a377='';return _0x56a377=typeof _0x205b67,_0x56a377===_0x1a4a7b(0x1f6)?this[_0x1a4a7b(0x176)](_0x205b67)===_0x1a4a7b(0x240)?_0x56a377='array':this[_0x1a4a7b(0x176)](_0x205b67)===_0x1a4a7b(0x1ef)?_0x56a377=_0x1a4a7b(0x220):this[_0x1a4a7b(0x176)](_0x205b67)===_0x1a4a7b(0x24d)?_0x56a377='bigint':_0x205b67===null?_0x56a377='null':_0x205b67[_0x1a4a7b(0x1e0)]&&(_0x56a377=_0x205b67[_0x1a4a7b(0x1e0)][_0x1a4a7b(0x20c)]||_0x56a377):_0x56a377===_0x1a4a7b(0x207)&&this[_0x1a4a7b(0x264)]&&_0x205b67 instanceof this[_0x1a4a7b(0x264)]&&(_0x56a377='HTMLAllCollection'),_0x56a377;}[_0x29d2cf(0x176)](_0x2d3b87){var _0x4338f3=_0x29d2cf;return Object['prototype']['toString'][_0x4338f3(0x21a)](_0x2d3b87);}['_isPrimitiveType'](_0x3ed271){var _0x448809=_0x29d2cf;return _0x3ed271===_0x448809(0x216)||_0x3ed271===_0x448809(0x1e1)||_0x3ed271===_0x448809(0x24f);}[_0x29d2cf(0x1d7)](_0x175090){var _0x41274a=_0x29d2cf;return _0x175090===_0x41274a(0x228)||_0x175090===_0x41274a(0x184)||_0x175090===_0x41274a(0x259);}[_0x29d2cf(0x237)](_0x26f3af,_0x28955e,_0x5152e0,_0x27d408,_0x4a237a,_0xa2c64a){var _0x435d6e=this;return function(_0x256e57){var _0x92c114=_0x35f9,_0x30f89c=_0x4a237a['node'][_0x92c114(0x1ff)],_0x5a9874=_0x4a237a['node'][_0x92c114(0x1b1)],_0x3f18f0=_0x4a237a[_0x92c114(0x251)][_0x92c114(0x233)];_0x4a237a[_0x92c114(0x251)][_0x92c114(0x233)]=_0x30f89c,_0x4a237a[_0x92c114(0x251)][_0x92c114(0x1b1)]=typeof _0x27d408==_0x92c114(0x24f)?_0x27d408:_0x256e57,_0x26f3af['push'](_0x435d6e[_0x92c114(0x22c)](_0x28955e,_0x5152e0,_0x27d408,_0x4a237a,_0xa2c64a)),_0x4a237a[_0x92c114(0x251)][_0x92c114(0x233)]=_0x3f18f0,_0x4a237a['node'][_0x92c114(0x1b1)]=_0x5a9874;};}[_0x29d2cf(0x1dd)](_0x43dfae,_0x45f82a,_0x11ac05,_0x1b4804,_0x14c25f,_0x42d7e9,_0x428088){var _0x358e1b=_0x29d2cf,_0xb03fc8=this;return _0x45f82a['_p_'+_0x14c25f[_0x358e1b(0x268)]()]=!0x0,function(_0x22c959){var _0xb32dd1=_0x358e1b,_0x46ce97=_0x42d7e9['node'][_0xb32dd1(0x1ff)],_0x5c2a0e=_0x42d7e9[_0xb32dd1(0x251)][_0xb32dd1(0x1b1)],_0x542f58=_0x42d7e9[_0xb32dd1(0x251)][_0xb32dd1(0x233)];_0x42d7e9[_0xb32dd1(0x251)][_0xb32dd1(0x233)]=_0x46ce97,_0x42d7e9[_0xb32dd1(0x251)][_0xb32dd1(0x1b1)]=_0x22c959,_0x43dfae['push'](_0xb03fc8[_0xb32dd1(0x22c)](_0x11ac05,_0x1b4804,_0x14c25f,_0x42d7e9,_0x428088)),_0x42d7e9[_0xb32dd1(0x251)][_0xb32dd1(0x233)]=_0x542f58,_0x42d7e9[_0xb32dd1(0x251)]['index']=_0x5c2a0e;};}['_property'](_0x58d0a1,_0x4a8ed9,_0x82961b,_0x1a6f20,_0x15180a){var _0xa5a6a7=_0x29d2cf,_0x3c5f41=this;_0x15180a||(_0x15180a=function(_0x2ac694,_0x3f7f62){return _0x2ac694[_0x3f7f62];});var _0x5225ff=_0x82961b[_0xa5a6a7(0x268)](),_0x1fd457=_0x1a6f20['expressionsToEvaluate']||{},_0x78fe70=_0x1a6f20[_0xa5a6a7(0x224)],_0x3fc305=_0x1a6f20[_0xa5a6a7(0x212)];try{var _0x3b06b8=this[_0xa5a6a7(0x1de)](_0x58d0a1),_0x3ae52c=_0x5225ff;_0x3b06b8&&_0x3ae52c[0x0]==='\\x27'&&(_0x3ae52c=_0x3ae52c['substr'](0x1,_0x3ae52c[_0xa5a6a7(0x1a6)]-0x2));var _0x14ea4a=_0x1a6f20[_0xa5a6a7(0x1e5)]=_0x1fd457['_p_'+_0x3ae52c];_0x14ea4a&&(_0x1a6f20[_0xa5a6a7(0x224)]=_0x1a6f20[_0xa5a6a7(0x224)]+0x1),_0x1a6f20[_0xa5a6a7(0x212)]=!!_0x14ea4a;var _0x1db38d=typeof _0x82961b==_0xa5a6a7(0x179),_0x4f470f={'name':_0x1db38d||_0x3b06b8?_0x5225ff:this['_propertyName'](_0x5225ff)};if(_0x1db38d&&(_0x4f470f[_0xa5a6a7(0x179)]=!0x0),!(_0x4a8ed9===_0xa5a6a7(0x1f0)||_0x4a8ed9==='Error')){var _0x1b1f9a=this[_0xa5a6a7(0x18e)](_0x58d0a1,_0x82961b);if(_0x1b1f9a&&(_0x1b1f9a[_0xa5a6a7(0x1ce)]&&(_0x4f470f[_0xa5a6a7(0x1be)]=!0x0),_0x1b1f9a['get']&&!_0x14ea4a&&!_0x1a6f20[_0xa5a6a7(0x1a4)]))return _0x4f470f[_0xa5a6a7(0x1f3)]=!0x0,this['_processTreeNodeResult'](_0x4f470f,_0x1a6f20),_0x4f470f;}var _0x573390;try{_0x573390=_0x15180a(_0x58d0a1,_0x82961b);}catch(_0x24c7d8){return _0x4f470f={'name':_0x5225ff,'type':_0xa5a6a7(0x241),'error':_0x24c7d8['message']},this['_processTreeNodeResult'](_0x4f470f,_0x1a6f20),_0x4f470f;}var _0x24e742=this[_0xa5a6a7(0x199)](_0x573390),_0x812c90=this[_0xa5a6a7(0x1c3)](_0x24e742);if(_0x4f470f['type']=_0x24e742,_0x812c90)this['_processTreeNodeResult'](_0x4f470f,_0x1a6f20,_0x573390,function(){var _0x2b0fd2=_0xa5a6a7;_0x4f470f[_0x2b0fd2(0x249)]=_0x573390[_0x2b0fd2(0x1dc)](),!_0x14ea4a&&_0x3c5f41[_0x2b0fd2(0x1f7)](_0x24e742,_0x4f470f,_0x1a6f20,{});});else{var _0x1e375a=_0x1a6f20[_0xa5a6a7(0x1b0)]&&_0x1a6f20['level']<_0x1a6f20['autoExpandMaxDepth']&&_0x1a6f20[_0xa5a6a7(0x197)][_0xa5a6a7(0x250)](_0x573390)<0x0&&_0x24e742!==_0xa5a6a7(0x1e3)&&_0x1a6f20[_0xa5a6a7(0x196)]<_0x1a6f20[_0xa5a6a7(0x17b)];_0x1e375a||_0x1a6f20[_0xa5a6a7(0x209)]<_0x78fe70||_0x14ea4a?(this[_0xa5a6a7(0x23e)](_0x4f470f,_0x573390,_0x1a6f20,_0x14ea4a||{}),this[_0xa5a6a7(0x230)](_0x573390,_0x4f470f)):this[_0xa5a6a7(0x238)](_0x4f470f,_0x1a6f20,_0x573390,function(){var _0x1679de=_0xa5a6a7;_0x24e742===_0x1679de(0x1c5)||_0x24e742===_0x1679de(0x207)||(delete _0x4f470f[_0x1679de(0x249)],_0x4f470f[_0x1679de(0x1a7)]=!0x0);});}return _0x4f470f;}finally{_0x1a6f20[_0xa5a6a7(0x1e5)]=_0x1fd457,_0x1a6f20['depth']=_0x78fe70,_0x1a6f20[_0xa5a6a7(0x212)]=_0x3fc305;}}['_capIfString'](_0x2f2221,_0x3fcb4e,_0x2e8bc7,_0x4390cd){var _0x25b635=_0x29d2cf,_0xc810ae=_0x4390cd[_0x25b635(0x219)]||_0x2e8bc7[_0x25b635(0x219)];if((_0x2f2221===_0x25b635(0x1e1)||_0x2f2221===_0x25b635(0x184))&&_0x3fcb4e[_0x25b635(0x249)]){let _0x44287c=_0x3fcb4e['value']['length'];_0x2e8bc7[_0x25b635(0x265)]+=_0x44287c,_0x2e8bc7['allStrLength']>_0x2e8bc7[_0x25b635(0x260)]?(_0x3fcb4e['capped']='',delete _0x3fcb4e[_0x25b635(0x249)]):_0x44287c>_0xc810ae&&(_0x3fcb4e[_0x25b635(0x1a7)]=_0x3fcb4e[_0x25b635(0x249)][_0x25b635(0x24c)](0x0,_0xc810ae),delete _0x3fcb4e[_0x25b635(0x249)]);}}[_0x29d2cf(0x1de)](_0x4e0216){var _0x4c964a=_0x29d2cf;return!!(_0x4e0216&&_0x469561[_0x4c964a(0x22f)]&&this[_0x4c964a(0x176)](_0x4e0216)===_0x4c964a(0x17f)&&_0x4e0216[_0x4c964a(0x204)]);}[_0x29d2cf(0x215)](_0x571ea0){var _0x790212=_0x29d2cf;if(_0x571ea0[_0x790212(0x222)](/^\\d+$/))return _0x571ea0;var _0x15f27e;try{_0x15f27e=JSON[_0x790212(0x205)](''+_0x571ea0);}catch{_0x15f27e='\\x22'+this[_0x790212(0x176)](_0x571ea0)+'\\x22';}return _0x15f27e[_0x790212(0x222)](/^\"([a-zA-Z_][a-zA-Z_0-9]*)\"$/)?_0x15f27e=_0x15f27e['substr'](0x1,_0x15f27e[_0x790212(0x1a6)]-0x2):_0x15f27e=_0x15f27e[_0x790212(0x266)](/'/g,'\\x5c\\x27')['replace'](/\\\\\"/g,'\\x22')[_0x790212(0x266)](/(^\"|\"$)/g,'\\x27'),_0x15f27e;}[_0x29d2cf(0x238)](_0x48f9eb,_0x4f1560,_0x30fce4,_0x2d0d07){var _0x3550c6=_0x29d2cf;this['_treeNodePropertiesBeforeFullValue'](_0x48f9eb,_0x4f1560),_0x2d0d07&&_0x2d0d07(),this[_0x3550c6(0x230)](_0x30fce4,_0x48f9eb),this[_0x3550c6(0x257)](_0x48f9eb,_0x4f1560);}[_0x29d2cf(0x19d)](_0x4cec15,_0x42f959){var _0x4aaa8e=_0x29d2cf;this[_0x4aaa8e(0x1b6)](_0x4cec15,_0x42f959),this['_setNodeQueryPath'](_0x4cec15,_0x42f959),this[_0x4aaa8e(0x180)](_0x4cec15,_0x42f959),this['_setNodePermissions'](_0x4cec15,_0x42f959);}[_0x29d2cf(0x1b6)](_0x1cbfcd,_0x4f01ae){}['_setNodeQueryPath'](_0x5c701c,_0x112285){}[_0x29d2cf(0x195)](_0x29cfeb,_0x5459c8){}[_0x29d2cf(0x217)](_0x426a01){var _0x38b0e6=_0x29d2cf;return _0x426a01===this[_0x38b0e6(0x1e6)];}[_0x29d2cf(0x257)](_0x2b962f,_0x3735c1){var _0x1fafd0=_0x29d2cf;this[_0x1fafd0(0x195)](_0x2b962f,_0x3735c1),this[_0x1fafd0(0x21c)](_0x2b962f),_0x3735c1[_0x1fafd0(0x1b3)]&&this[_0x1fafd0(0x1ed)](_0x2b962f),this['_addFunctionsNode'](_0x2b962f,_0x3735c1),this[_0x1fafd0(0x261)](_0x2b962f,_0x3735c1),this[_0x1fafd0(0x243)](_0x2b962f);}['_additionalMetadata'](_0x7aee0a,_0x3a2215){var _0x53e1ab=_0x29d2cf;try{_0x7aee0a&&typeof _0x7aee0a[_0x53e1ab(0x1a6)]==_0x53e1ab(0x24f)&&(_0x3a2215[_0x53e1ab(0x1a6)]=_0x7aee0a[_0x53e1ab(0x1a6)]);}catch{}if(_0x3a2215[_0x53e1ab(0x226)]===_0x53e1ab(0x24f)||_0x3a2215[_0x53e1ab(0x226)]===_0x53e1ab(0x259)){if(isNaN(_0x3a2215[_0x53e1ab(0x249)]))_0x3a2215[_0x53e1ab(0x22b)]=!0x0,delete _0x3a2215['value'];else switch(_0x3a2215[_0x53e1ab(0x249)]){case Number[_0x53e1ab(0x25a)]:_0x3a2215['positiveInfinity']=!0x0,delete _0x3a2215['value'];break;case Number['NEGATIVE_INFINITY']:_0x3a2215[_0x53e1ab(0x200)]=!0x0,delete _0x3a2215['value'];break;case 0x0:this['_isNegativeZero'](_0x3a2215[_0x53e1ab(0x249)])&&(_0x3a2215[_0x53e1ab(0x17c)]=!0x0);break;}}else _0x3a2215['type']===_0x53e1ab(0x1e3)&&typeof _0x7aee0a[_0x53e1ab(0x20c)]==_0x53e1ab(0x1e1)&&_0x7aee0a[_0x53e1ab(0x20c)]&&_0x3a2215[_0x53e1ab(0x20c)]&&_0x7aee0a[_0x53e1ab(0x20c)]!==_0x3a2215['name']&&(_0x3a2215[_0x53e1ab(0x1e4)]=_0x7aee0a[_0x53e1ab(0x20c)]);}[_0x29d2cf(0x232)](_0x74dcea){var _0x148c71=_0x29d2cf;return 0x1/_0x74dcea===Number[_0x148c71(0x1bb)];}[_0x29d2cf(0x1ed)](_0x505b13){var _0x476b3a=_0x29d2cf;!_0x505b13['props']||!_0x505b13['props']['length']||_0x505b13[_0x476b3a(0x226)]===_0x476b3a(0x1f0)||_0x505b13['type']===_0x476b3a(0x22f)||_0x505b13[_0x476b3a(0x226)]==='Set'||_0x505b13[_0x476b3a(0x1b5)]['sort'](function(_0x383fe6,_0x215965){var _0x4a3f6d=_0x476b3a,_0x4dedf9=_0x383fe6[_0x4a3f6d(0x20c)][_0x4a3f6d(0x1c0)](),_0x1458e5=_0x215965[_0x4a3f6d(0x20c)][_0x4a3f6d(0x1c0)]();return _0x4dedf9<_0x1458e5?-0x1:_0x4dedf9>_0x1458e5?0x1:0x0;});}[_0x29d2cf(0x1ea)](_0x168931,_0x38d221){var _0x549d05=_0x29d2cf;if(!(_0x38d221[_0x549d05(0x1bf)]||!_0x168931[_0x549d05(0x1b5)]||!_0x168931[_0x549d05(0x1b5)][_0x549d05(0x1a6)])){for(var _0x3abef1=[],_0x1d9696=[],_0x1dff9b=0x0,_0x3cc87e=_0x168931['props'][_0x549d05(0x1a6)];_0x1dff9b<_0x3cc87e;_0x1dff9b++){var _0x206879=_0x168931[_0x549d05(0x1b5)][_0x1dff9b];_0x206879['type']===_0x549d05(0x1e3)?_0x3abef1[_0x549d05(0x248)](_0x206879):_0x1d9696['push'](_0x206879);}if(!(!_0x1d9696['length']||_0x3abef1[_0x549d05(0x1a6)]<=0x1)){_0x168931[_0x549d05(0x1b5)]=_0x1d9696;var _0x2f9a3d={'functionsNode':!0x0,'props':_0x3abef1};this[_0x549d05(0x1b6)](_0x2f9a3d,_0x38d221),this['_setNodeLabel'](_0x2f9a3d,_0x38d221),this[_0x549d05(0x21c)](_0x2f9a3d),this[_0x549d05(0x213)](_0x2f9a3d,_0x38d221),_0x2f9a3d['id']+='\\x20f',_0x168931['props']['unshift'](_0x2f9a3d);}}}['_addLoadNode'](_0x5a8caa,_0x15c2cf){}[_0x29d2cf(0x21c)](_0x2f9ebc){}[_0x29d2cf(0x19a)](_0x5317dc){var _0x1a5b70=_0x29d2cf;return Array[_0x1a5b70(0x1eb)](_0x5317dc)||typeof _0x5317dc==_0x1a5b70(0x1f6)&&this[_0x1a5b70(0x176)](_0x5317dc)===_0x1a5b70(0x240);}[_0x29d2cf(0x213)](_0x3c64d4,_0x28e34f){}['_cleanNode'](_0x2d84b4){var _0x572954=_0x29d2cf;delete _0x2d84b4['_hasSymbolPropertyOnItsPath'],delete _0x2d84b4[_0x572954(0x247)],delete _0x2d84b4[_0x572954(0x25d)];}[_0x29d2cf(0x180)](_0xeb9571,_0x5e3993){}}let _0x199787=new _0x5ec4cd(),_0x1498c5={'props':0x64,'elements':0x64,'strLength':0x400*0x32,'totalStrLength':0x400*0x32,'autoExpandLimit':0x1388,'autoExpandMaxDepth':0xa},_0x30afd0={'props':0x5,'elements':0x5,'strLength':0x100,'totalStrLength':0x100*0x3,'autoExpandLimit':0x1e,'autoExpandMaxDepth':0x2};function _0x17967e(_0x507968,_0x31e24b,_0x257234,_0x29d433,_0x566bd5,_0x1a48a6){var _0x1bd8e6=_0x29d2cf;let _0x4a26bb,_0x4979bb;try{_0x4979bb=_0xd43b51(),_0x4a26bb=_0x6612ed[_0x31e24b],!_0x4a26bb||_0x4979bb-_0x4a26bb['ts']>0x1f4&&_0x4a26bb[_0x1bd8e6(0x186)]&&_0x4a26bb[_0x1bd8e6(0x263)]/_0x4a26bb[_0x1bd8e6(0x186)]<0x64?(_0x6612ed[_0x31e24b]=_0x4a26bb={'count':0x0,'time':0x0,'ts':_0x4979bb},_0x6612ed[_0x1bd8e6(0x1fa)]={}):_0x4979bb-_0x6612ed[_0x1bd8e6(0x1fa)]['ts']>0x32&&_0x6612ed['hits'][_0x1bd8e6(0x186)]&&_0x6612ed[_0x1bd8e6(0x1fa)]['time']/_0x6612ed[_0x1bd8e6(0x1fa)][_0x1bd8e6(0x186)]<0x64&&(_0x6612ed['hits']={});let _0x11e42b=[],_0x51a87d=_0x4a26bb[_0x1bd8e6(0x1fd)]||_0x6612ed['hits']['reduceLimits']?_0x30afd0:_0x1498c5,_0x279081=_0x3d1f84=>{var _0x2121eb=_0x1bd8e6;let _0x275cb1={};return _0x275cb1['props']=_0x3d1f84['props'],_0x275cb1[_0x2121eb(0x181)]=_0x3d1f84[_0x2121eb(0x181)],_0x275cb1['strLength']=_0x3d1f84[_0x2121eb(0x219)],_0x275cb1[_0x2121eb(0x260)]=_0x3d1f84[_0x2121eb(0x260)],_0x275cb1[_0x2121eb(0x17b)]=_0x3d1f84[_0x2121eb(0x17b)],_0x275cb1['autoExpandMaxDepth']=_0x3d1f84[_0x2121eb(0x192)],_0x275cb1[_0x2121eb(0x1b3)]=!0x1,_0x275cb1[_0x2121eb(0x1bf)]=!_0x4a0502,_0x275cb1[_0x2121eb(0x224)]=0x1,_0x275cb1['level']=0x0,_0x275cb1['expId']=_0x2121eb(0x256),_0x275cb1[_0x2121eb(0x190)]=_0x2121eb(0x1cf),_0x275cb1[_0x2121eb(0x1b0)]=!0x0,_0x275cb1[_0x2121eb(0x197)]=[],_0x275cb1[_0x2121eb(0x196)]=0x0,_0x275cb1[_0x2121eb(0x1a4)]=!0x0,_0x275cb1[_0x2121eb(0x265)]=0x0,_0x275cb1[_0x2121eb(0x251)]={'current':void 0x0,'parent':void 0x0,'index':0x0},_0x275cb1;};for(var _0x45fc8c=0x0;_0x45fc8c<_0x566bd5['length'];_0x45fc8c++)_0x11e42b[_0x1bd8e6(0x248)](_0x199787[_0x1bd8e6(0x23e)]({'timeNode':_0x507968==='time'||void 0x0},_0x566bd5[_0x45fc8c],_0x279081(_0x51a87d),{}));if(_0x507968===_0x1bd8e6(0x1a9)||_0x507968==='error'){let _0x8ce258=Error[_0x1bd8e6(0x1db)];try{Error['stackTraceLimit']=0x1/0x0,_0x11e42b['push'](_0x199787[_0x1bd8e6(0x23e)]({'stackNode':!0x0},new Error()[_0x1bd8e6(0x208)],_0x279081(_0x51a87d),{'strLength':0x1/0x0}));}finally{Error[_0x1bd8e6(0x1db)]=_0x8ce258;}}return{'method':'log','version':_0x60bbb7,'args':[{'ts':_0x257234,'session':_0x29d433,'args':_0x11e42b,'id':_0x31e24b,'context':_0x1a48a6}]};}catch(_0x290f70){return{'method':_0x1bd8e6(0x254),'version':_0x60bbb7,'args':[{'ts':_0x257234,'session':_0x29d433,'args':[{'type':_0x1bd8e6(0x241),'error':_0x290f70&&_0x290f70['message']}],'id':_0x31e24b,'context':_0x1a48a6}]};}finally{try{if(_0x4a26bb&&_0x4979bb){let _0x295869=_0xd43b51();_0x4a26bb[_0x1bd8e6(0x186)]++,_0x4a26bb[_0x1bd8e6(0x263)]+=_0x4ed784(_0x4979bb,_0x295869),_0x4a26bb['ts']=_0x295869,_0x6612ed[_0x1bd8e6(0x1fa)][_0x1bd8e6(0x186)]++,_0x6612ed['hits'][_0x1bd8e6(0x263)]+=_0x4ed784(_0x4979bb,_0x295869),_0x6612ed[_0x1bd8e6(0x1fa)]['ts']=_0x295869,(_0x4a26bb['count']>0x32||_0x4a26bb['time']>0x64)&&(_0x4a26bb[_0x1bd8e6(0x1fd)]=!0x0),(_0x6612ed[_0x1bd8e6(0x1fa)][_0x1bd8e6(0x186)]>0x3e8||_0x6612ed['hits'][_0x1bd8e6(0x263)]>0x12c)&&(_0x6612ed['hits'][_0x1bd8e6(0x1fd)]=!0x0);}}catch{}}}return _0x17967e;}function _0x417e(){var _0x4051ab=['versions','endsWith','getOwnPropertyNames','_getOwnPropertyNames','NEGATIVE_INFINITY','disabledLog','HTMLAllCollection','setter','noFunctions','toLowerCase','startsWith','_disposeWebsocket','_isPrimitiveType','get','null','includes','next.js','path','hostname','_isSet','hasOwnProperty','_allowedToConnectOnSend','now','set','root_exp','pop','default','NEXT_RUNTIME','_connectAttemptCount','timeStamp','split','610336YhbooH','_isPrimitiveWrapperType','concat','_quotedRegExp','Console\\x20Ninja\\x20failed\\x20to\\x20send\\x20logs,\\x20restarting\\x20the\\x20process\\x20may\\x20help;\\x20also\\x20see\\x20','stackTraceLimit','valueOf','_addObjectProperty','_isMap','_p_name','constructor','string','_maxConnectAttemptCount','function','funcName','expressionsToEvaluate','_undefined','readyState','prototype','send','_addFunctionsNode','isArray','__es'+'Module','_sortProps','getWebSocketClass','[object\\x20Date]','array','_WebSocket','elapsed','getter','_extendedWarning','610640OfJPVo','object','_capIfString','fromCharCode','Buffer','hits','method','see\\x20https://tinyurl.com/2vt8jxzw\\x20for\\x20more\\x20info.','reduceLimits','bigint','current','negativeInfinity','cappedProps',[\"localhost\",\"127.0.0.1\",\"example.cypress.io\",\"Pablos-MacBook-Pro.local\",\"192.168.1.80\",\"10.211.55.2\",\"10.37.129.2\"],'reload','forEach','stringify','_keyStrRegExp','undefined','stack','level','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host,\\x20see\\x20','_sendErrorMessage','name','_webSocketErrorDocsLink','2140510TjgMza','enumerable','https://tinyurl.com/37x8b79t','create','isExpressionToEvaluate','_setNodePermissions','args','_propertyName','boolean','_isUndefined','remix','strLength','call','error','_setNodeExpandableState','location','unref','slice','date','onopen','match','1','depth','parse','type','getOwnPropertySymbols','Boolean','Set','_connected','nan','_property','1.0.0','4518rvEVve','Map','_additionalMetadata','global','_isNegativeZero','parent','origin','1755690860929','_connecting','_addProperty','_processTreeNodeResult','_getOwnPropertySymbols','nodeModules','onerror','_console_ninja',\"/Users/pabloandres/.cursor/extensions/wallabyjs.console-ninja-1.0.466-universal/node_modules\",'serialize','_Symbol','[object\\x20Array]','unknown','port','_cleanNode','perf_hooks','_inBrowser','_allowedToSend','_hasSetOnItsPath','push','value','logger\\x20websocket\\x20error','_numberRegExp','substr','[object\\x20BigInt]','edge','number','indexOf','node','_blacklistedProperty','11jWEfxP','log','join','root_exp_id','_treeNodePropertiesAfterFullValue','1427570NmOgrl','Number','POSITIVE_INFINITY','logger\\x20failed\\x20to\\x20connect\\x20to\\x20host','7536JKlTMb','_hasMapOnItsPath','url','_socket','totalStrLength','_addLoadNode','catch','time','_HTMLAllCollection','allStrLength','replace','_p_length','toString','590033hTbVMw','_ws','_objectToString','WebSocket','message','symbol','then','autoExpandLimit','negativeZero','59234','696689UQeRpO','[object\\x20Map]','_setNodeExpressionPath','elements','127.0.0.1','console','String','[object\\x20Set]','count','host','env','_reconnectTimeout','performance','_dateToString','failed\\x20to\\x20connect\\x20to\\x20host:\\x20','ws/index.js','_getOwnPropertyDescriptor','3NOsSZh','rootExpression','_WebSocketClass','autoExpandMaxDepth','...','_inNextEdge','_setNodeLabel','autoExpandPropertyCount','autoExpandPreviousObjects','_regExpToString','_type','_isArray','getOwnPropertyDescriptor','warn','_treeNodePropertiesBeforeFullValue','map','hrtime','getPrototypeOf','RegExp','eventReceivedCallback','close','resolveGetters','24whSVBV','length','capped','_consoleNinjaAllowedToStart','trace','data','gateway.docker.internal','_connectToHostNow','test','process','\\x20browser','autoExpand','index','\\x20server','sortProps','_attemptToReconnectShortly','props','_setNodeId'];_0x417e=function(){return _0x4051ab;};return _0x417e();}((_0x4ce0da,_0xabf8d1,_0x289d72,_0xca10c4,_0xaf8387,_0x61a5f,_0x50dfcb,_0x18cbb2,_0x1f9244,_0x345055,_0x1f4791)=>{var _0x115d94=_0x13b49a;if(_0x4ce0da[_0x115d94(0x23c)])return _0x4ce0da[_0x115d94(0x23c)];let _0x1b0c8e={'consoleLog':()=>{},'consoleTrace':()=>{},'consoleTime':()=>{},'consoleTimeEnd':()=>{},'autoLog':()=>{},'autoLogMany':()=>{},'autoTraceMany':()=>{},'coverage':()=>{},'autoTrace':()=>{},'autoTime':()=>{},'autoTimeEnd':()=>{}};if(!X(_0x4ce0da,_0x18cbb2,_0xaf8387))return _0x4ce0da[_0x115d94(0x23c)]=_0x1b0c8e,_0x4ce0da[_0x115d94(0x23c)];let _0x5a6838=B(_0x4ce0da),_0x10401a=_0x5a6838[_0x115d94(0x1f2)],_0x3118ab=_0x5a6838[_0x115d94(0x1d4)],_0x4bfd2f=_0x5a6838[_0x115d94(0x1cd)],_0x54d6c1={'hits':{},'ts':{}},_0x4a6dbe=J(_0x4ce0da,_0x1f9244,_0x54d6c1,_0x61a5f),_0x4cbf4a=(_0x492276,_0x4a9ce9,_0x3ca94f,_0x5caef4,_0x2432c4,_0x4ff318)=>{var _0x3c5ecc=_0x115d94;let _0x515255=_0x4ce0da[_0x3c5ecc(0x23c)];try{return _0x4ce0da[_0x3c5ecc(0x23c)]=_0x1b0c8e,_0x4a6dbe(_0x492276,_0x4a9ce9,_0x3ca94f,_0x5caef4,_0x2432c4,_0x4ff318);}finally{_0x4ce0da[_0x3c5ecc(0x23c)]=_0x515255;}},_0x517d5a=_0x4c0c11=>{_0x54d6c1['ts'][_0x4c0c11]=_0x3118ab();},_0x2d68f3=(_0x307132,_0x4fa5e8)=>{var _0x483a58=_0x115d94;let _0x3cd648=_0x54d6c1['ts'][_0x4fa5e8];if(delete _0x54d6c1['ts'][_0x4fa5e8],_0x3cd648){let _0x394a49=_0x10401a(_0x3cd648,_0x3118ab());_0xbf3b0d(_0x4cbf4a(_0x483a58(0x263),_0x307132,_0x4bfd2f(),_0x4e3640,[_0x394a49],_0x4fa5e8));}},_0x3207e3=_0x508fe2=>{var _0x274605=_0x115d94,_0x59bc75;return _0xaf8387===_0x274605(0x1c7)&&_0x4ce0da['origin']&&((_0x59bc75=_0x508fe2==null?void 0x0:_0x508fe2[_0x274605(0x214)])==null?void 0x0:_0x59bc75['length'])&&(_0x508fe2[_0x274605(0x214)][0x0][_0x274605(0x234)]=_0x4ce0da[_0x274605(0x234)]),_0x508fe2;};_0x4ce0da[_0x115d94(0x23c)]={'consoleLog':(_0x5c5b88,_0x373d0a)=>{var _0x27efeb=_0x115d94;_0x4ce0da['console']['log']['name']!==_0x27efeb(0x1bc)&&_0xbf3b0d(_0x4cbf4a(_0x27efeb(0x254),_0x5c5b88,_0x4bfd2f(),_0x4e3640,_0x373d0a));},'consoleTrace':(_0x4f7373,_0x409a17)=>{var _0x327aed=_0x115d94,_0x5d3a08,_0x3b4f39;_0x4ce0da[_0x327aed(0x183)]['log']['name']!=='disabledTrace'&&((_0x3b4f39=(_0x5d3a08=_0x4ce0da[_0x327aed(0x1ae)])==null?void 0x0:_0x5d3a08[_0x327aed(0x1b7)])!=null&&_0x3b4f39[_0x327aed(0x251)]&&(_0x4ce0da['_ninjaIgnoreNextError']=!0x0),_0xbf3b0d(_0x3207e3(_0x4cbf4a(_0x327aed(0x1a9),_0x4f7373,_0x4bfd2f(),_0x4e3640,_0x409a17))));},'consoleError':(_0x255085,_0x2a3d79)=>{var _0x2d7cc0=_0x115d94;_0x4ce0da['_ninjaIgnoreNextError']=!0x0,_0xbf3b0d(_0x3207e3(_0x4cbf4a(_0x2d7cc0(0x21b),_0x255085,_0x4bfd2f(),_0x4e3640,_0x2a3d79)));},'consoleTime':_0x5ad827=>{_0x517d5a(_0x5ad827);},'consoleTimeEnd':(_0x1efe57,_0x4f3765)=>{_0x2d68f3(_0x4f3765,_0x1efe57);},'autoLog':(_0x240037,_0x5db6e4)=>{_0xbf3b0d(_0x4cbf4a('log',_0x5db6e4,_0x4bfd2f(),_0x4e3640,[_0x240037]));},'autoLogMany':(_0x1ab64b,_0x3f230a)=>{var _0x72acaa=_0x115d94;_0xbf3b0d(_0x4cbf4a(_0x72acaa(0x254),_0x1ab64b,_0x4bfd2f(),_0x4e3640,_0x3f230a));},'autoTrace':(_0xbb8527,_0x2a1c7d)=>{_0xbf3b0d(_0x3207e3(_0x4cbf4a('trace',_0x2a1c7d,_0x4bfd2f(),_0x4e3640,[_0xbb8527])));},'autoTraceMany':(_0x154e9b,_0x1edaeb)=>{var _0x25b2db=_0x115d94;_0xbf3b0d(_0x3207e3(_0x4cbf4a(_0x25b2db(0x1a9),_0x154e9b,_0x4bfd2f(),_0x4e3640,_0x1edaeb)));},'autoTime':(_0x1a189f,_0xca590f,_0x5c9513)=>{_0x517d5a(_0x5c9513);},'autoTimeEnd':(_0x3c6acf,_0x412384,_0x1f7134)=>{_0x2d68f3(_0x412384,_0x1f7134);},'coverage':_0x279ef1=>{_0xbf3b0d({'method':'coverage','version':_0x61a5f,'args':[{'id':_0x279ef1}]});}};let _0xbf3b0d=H(_0x4ce0da,_0xabf8d1,_0x289d72,_0xca10c4,_0xaf8387,_0x345055,_0x1f4791),_0x4e3640=_0x4ce0da['_console_ninja_session'];return _0x4ce0da['_console_ninja'];})(globalThis,_0x13b49a(0x182),_0x13b49a(0x17d),_0x13b49a(0x23d),'webpack',_0x13b49a(0x22d),_0x13b49a(0x235),_0x13b49a(0x202),'','',_0x13b49a(0x223));");}catch(e){}};/* istanbul ignore next */function oo_oo(i:string,...v:any[]){try{oo_cm().consoleLog(i, v);}catch(e){} return v};oo_oo;/* istanbul ignore next */function oo_tr(i:string,...v:any[]){try{oo_cm().consoleTrace(i, v);}catch(e){} return v};oo_tr;/* istanbul ignore next */function oo_tx(i:string,...v:any[]){try{oo_cm().consoleError(i, v);}catch(e){} return v};oo_tx;/* istanbul ignore next */function oo_ts(v?:string):string{try{oo_cm().consoleTime(v);}catch(e){} return v as string;};oo_ts;/* istanbul ignore next */function oo_te(v:string|undefined, i:string):string{try{oo_cm().consoleTimeEnd(v, i);}catch(e){} return v as string;};oo_te;/*eslint unicorn/no-abusive-eslint-disable:,eslint-comments/disable-enable-pair:,eslint-comments/no-unlimited-disable:,eslint-comments/no-aggregating-enable:,eslint-comments/no-duplicate-disable:,eslint-comments/no-unused-disable:,eslint-comments/no-unused-enable:,*/