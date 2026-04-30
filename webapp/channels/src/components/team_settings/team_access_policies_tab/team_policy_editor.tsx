// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {AccessControlPolicy, AccessControlPolicyActiveUpdate, AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {hasUsableAttributes} from 'components/admin_console/access_control/editors/shared';
import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import ChannelList from 'components/admin_console/access_control/policy_details/channel_list';
import ChannelSelectorModal from 'components/channel_selector_modal';
import Input from 'components/widgets/inputs/input/input';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';
import Constants from 'utils/constants';

import TeamPolicyConfirmationModal from './team_policy_confirmation_modal';

import './team_policy_editor.scss';

const SAVE_RESULT_SAVED = 'saved' as const;
const SAVE_RESULT_ERROR = 'error' as const;

interface ChannelChanges {
    removed: Record<string, ChannelWithTeamData>;
    added: Record<string, ChannelWithTeamData>;
    removedCount: number;
}

interface PolicyActiveStatus {
    id: string;
    active: boolean;
}

type Props = {
    teamId: string;
    policyId?: string;
    accessControlSettings: AccessControlSettings;
    setAreThereUnsavedChanges?: (unsaved: boolean) => void;
    showTabSwitchError?: boolean;
    onNavigateBack: (successMessage?: string) => void;
    actions: {
        fetchPolicy: (id: string) => Promise<ActionResult>;
        createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
        deletePolicy: (id: string) => Promise<ActionResult>;
        searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => Promise<ActionResult>;
        assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
        unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
        createJob: (job: JobTypeBase & {data: any}) => Promise<ActionResult>;
        updateAccessControlPoliciesActive: (states: AccessControlPolicyActiveUpdate[]) => Promise<ActionResult>;
    };
};

export default function TeamPolicyEditor({
    teamId,
    policyId,
    accessControlSettings,
    setAreThereUnsavedChanges,
    showTabSwitchError,
    onNavigateBack,
    actions,
}: Props) {
    const {formatMessage} = useIntl();
    const abacActions = useChannelAccessControlActions(undefined, teamId);

    // Policy state
    const [policyName, setPolicyName] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [expression, setExpression] = useState('');
    const [originalExpression, setOriginalExpression] = useState('');

    // Channel state
    const [channelChanges, setChannelChanges] = useState<ChannelChanges>({removed: {}, added: {}, removedCount: 0});
    const [policyActiveStatusChanges, setPolicyActiveStatusChanges] = useState<PolicyActiveStatus[]>([]);
    const [channelsCount, setChannelsCount] = useState(0);
    const [savedChannelIds, setSavedChannelIds] = useState<string[]>([]);

    // Map of saved channelId → channel type ('O' | 'P' | ...). Used to compute
    // how many public vs. private channels a save will affect, so the
    // confirmation modal can pick the right messaging. Only 'O'/'P' can ever
    // be assigned to a policy, but we key by ID so removals map cleanly.
    const [savedChannelTypes, setSavedChannelTypes] = useState<Record<string, string>>({});
    const [addChannelOpen, setAddChannelOpen] = useState(false);

    // Attribute state
    const [autocompleteResult, setAutocompleteResult] = useState<UserPropertyField[]>([]);
    const [attributesLoaded, setAttributesLoaded] = useState(false);

    // Save state
    const [saveChangesPanelState, setSaveChangesPanelState] = useState<SaveChangesPanelState>();
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [backClicked, setBackClicked] = useState(false);

    const noUsableAttributes = attributesLoaded && !hasUsableAttributes(autocompleteResult, accessControlSettings.EnableUserManagedAttributes);

    const handleExpressionChange = useCallback((value: string) => {
        setExpression(value);
        if (formError) {
            setFormError('');
            setSaveChangesPanelState(undefined);
        }
    }, [formError]);

    // Load attributes on mount
    useEffect(() => {
        abacActions.getAccessControlFields('', 100).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
            setAttributesLoaded(true);
        }).catch(() => {
            setAttributesLoaded(true);
        });
    }, []);// eslint-disable-line react-hooks/exhaustive-deps

    // Load policy data for edit mode
    useEffect(() => {
        if (!policyId) {
            return;
        }
        actions.fetchPolicy(policyId).then((result) => {
            if (result.data) {
                setPolicyName(result.data.name || '');
                setOriginalName(result.data.name || '');
                setExpression(result.data.rules?.[0]?.expression || '');
                setOriginalExpression(result.data.rules?.[0]?.expression || '');
            }
        });
        actions.searchChannels(policyId, '', {per_page: 1000}).then((result) => {
            const channels: ChannelWithTeamData[] = result.data?.channels || [];
            setChannelsCount(result.data?.total_count || 0);
            setSavedChannelIds(channels.map((ch) => ch.id));
            setSavedChannelTypes(Object.fromEntries(channels.map((ch) => [ch.id, ch.type])));
        });
    }, [policyId]);// eslint-disable-line react-hooks/exhaustive-deps

    // Track unsaved changes
    const hasUnsavedChanges = useMemo(() => {
        return policyName !== originalName ||
            expression !== originalExpression ||
            Object.keys(channelChanges.added).length > 0 ||
            channelChanges.removedCount > 0 ||
            policyActiveStatusChanges.length > 0;
    }, [policyName, originalName, expression, originalExpression, channelChanges, policyActiveStatusChanges]);

    useEffect(() => {
        setAreThereUnsavedChanges?.(hasUnsavedChanges);
    }, [hasUnsavedChanges, setAreThereUnsavedChanges]);

    const shouldShowPanel = useMemo(() => {
        return hasUnsavedChanges || saveChangesPanelState === SAVE_RESULT_SAVED || showTabSwitchError;
    }, [hasUnsavedChanges, saveChangesPanelState, showTabSwitchError]);

    // Channel management
    const addToNewChannels = useCallback((channels: ChannelWithTeamData[]) => {
        setChannelChanges((prev) => {
            const newChanges = cloneDeep(prev);
            channels.forEach((channel) => {
                if (newChanges.removed[channel.id]?.id === channel.id) {
                    delete newChanges.removed[channel.id];
                    newChanges.removedCount--;
                } else {
                    newChanges.added[channel.id] = channel;
                }
            });
            return newChanges;
        });
        if (formError) {
            setFormError('');
            setSaveChangesPanelState(undefined);
        }
    }, [formError]);

    const addToRemovedChannels = useCallback((channel: ChannelWithTeamData) => {
        setChannelChanges((prev) => {
            const newChanges = cloneDeep(prev);
            if (newChanges.added[channel.id]?.id === channel.id) {
                delete newChanges.added[channel.id];
            } else if (newChanges.removed[channel.id]?.id !== channel.id) {
                newChanges.removedCount++;
                newChanges.removed[channel.id] = channel;
            }
            return newChanges;
        });
    }, []);

    const hasChannels = useCallback(() => {
        return ((channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length) > 0;
    }, [channelsCount, channelChanges]);

    // True iff the policy will be applied to at least one private channel after
    // pending changes are committed. Public-channel ABAC is advisory and cannot
    // lock anyone out, so the self-inclusion guard only matters when a private
    // channel is in scope.
    const hasPrivateChannelInScope = useCallback(() => {
        for (const [id, type] of Object.entries(savedChannelTypes)) {
            if (channelChanges.removed[id]) {
                continue;
            }
            if (type === Constants.PRIVATE_CHANNEL) {
                return true;
            }
        }
        for (const ch of Object.values(channelChanges.added)) {
            if (ch.type === Constants.PRIVATE_CHANNEL) {
                return true;
            }
        }
        return false;
    }, [savedChannelTypes, channelChanges]);

    const confirmationChannelCounts = useMemo(() => {
        let publicCount = 0;
        let privateCount = 0;
        for (const [id, type] of Object.entries(savedChannelTypes)) {
            if (channelChanges.removed[id]) {
                continue;
            }
            if (type === Constants.OPEN_CHANNEL) {
                publicCount++;
            } else if (type === Constants.PRIVATE_CHANNEL) {
                privateCount++;
            }
        }
        for (const ch of Object.values(channelChanges.added)) {
            if (ch.type === Constants.OPEN_CHANNEL) {
                publicCount++;
            } else if (ch.type === Constants.PRIVATE_CHANNEL) {
                privateCount++;
            }
        }
        const channelsAffected = (channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length;
        return {publicCount, privateCount, channelsAffected};
    }, [savedChannelTypes, channelChanges, channelsCount]);

    const validateForm = useCallback(async () => {
        if (policyName.length === 0) {
            setFormError(formatMessage({id: 'admin.access_control.policy.edit_policy.error.name_required', defaultMessage: 'Please add a name to the policy'}));
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            return false;
        }
        if (expression.length === 0) {
            setFormError(formatMessage({id: 'admin.access_control.policy.edit_policy.error.expression_required', defaultMessage: 'Please add an expression to the policy'}));
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            return false;
        }
        if (expression.includes('== ""') || expression.includes("== ''") || expression.includes('in []')) {
            setFormError(formatMessage({id: 'team_settings.policy_editor.error.incomplete_rule', defaultMessage: 'Please complete all attribute rules with a value'}));
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            return false;
        }
        if (!hasChannels()) {
            setFormError(formatMessage({id: 'team_settings.policy_editor.error.channels_required', defaultMessage: 'Please assign at least one channel to the policy'}));
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            return false;
        }

        // Validate self-inclusion: delegated admin must satisfy the policy's rules.
        // Skipped when the policy applies only to public channels — those are
        // advisory under ABAC and can't kick anyone out, so a non-matching admin
        // is never at risk of locking themselves out.
        if (expression.trim() && hasPrivateChannelInScope()) {
            try {
                const result = await abacActions.validateExpressionAgainstRequester(expression);
                if (!result.data?.requester_matches) {
                    setFormError(formatMessage({id: 'team_settings.policy_editor.error.self_exclusion', defaultMessage: 'You cannot save these rules because they would remove your access to this policy. Adjust the rules to include your user attributes.'}));
                    setSaveChangesPanelState(SAVE_RESULT_ERROR);
                    return false;
                }
            } catch {
                setFormError(formatMessage({id: 'team_settings.policy_editor.error.validation_failed', defaultMessage: 'Failed to validate membership rules. Please try again.'}));
                setSaveChangesPanelState(SAVE_RESULT_ERROR);
                return false;
            }
        }

        return true;
    }, [policyName, expression, hasChannels, hasPrivateChannelInScope, formatMessage, abacActions]);

    const handleSave = useCallback(async () => {
        if (!await validateForm()) {
            return;
        }

        setSaving(true);
        let currentPolicyId = policyId;
        try {
            const result = await actions.createPolicy({
                id: currentPolicyId || '',
                name: policyName,
                rules: [{expression, actions: ['*']}] as AccessControlPolicyRule[],
                type: 'parent',
                version: 'v0.2',
            });

            if (result.error) {
                setFormError(result.error.message);
                setSaveChangesPanelState(SAVE_RESULT_ERROR);
                return;
            }

            currentPolicyId = result.data?.id;
            if (!currentPolicyId) {
                setSaveChangesPanelState(SAVE_RESULT_ERROR);
                return;
            }

            // Assign/unassign channels
            // throw on errors that have a server_error_id (actual API errors)
            if (channelChanges.removedCount > 0) {
                const unassignResult = await actions.unassignChannelsFromAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.removed));
                if (unassignResult.error?.server_error_id) {
                    throw new Error(unassignResult.error.message || 'Failed to unassign channels');
                }
            }
            if (Object.keys(channelChanges.added).length > 0) {
                const assignResult = await actions.assignChannelsToAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.added));
                if (assignResult.error?.server_error_id) {
                    throw new Error(assignResult.error.message || 'Failed to assign channels');
                }
            }

            // Update active status
            if (policyActiveStatusChanges.length > 0) {
                const activeResult = await actions.updateAccessControlPoliciesActive(policyActiveStatusChanges);
                if (activeResult.error?.server_error_id) {
                    throw new Error(activeResult.error.message || 'Failed to update active status');
                }
            }

            // Trigger sync only when rules or channels changed
            const hasRuleOrChannelChanges = expression !== originalExpression ||
                Object.keys(channelChanges.added).length > 0 ||
                channelChanges.removedCount > 0 ||
                policyActiveStatusChanges.length > 0 ||
                !policyId;
            if (hasRuleOrChannelChanges) {
                await abacActions.createAccessControlSyncJob({policy_id: currentPolicyId, team_id: teamId});
            }

            setShowConfirmationModal(false);
            onNavigateBack(policyId ? formatMessage({id: 'team_settings.policy_editor.policy_updated', defaultMessage: 'Policy updated'}) : formatMessage({id: 'team_settings.policy_editor.policy_saved', defaultMessage: 'Policy saved'}));
        } catch (error: any) {
            // Roll back newly created policy if channel assignment failed
            if (!policyId && currentPolicyId) {
                try {
                    await actions.deletePolicy(currentPolicyId);
                } catch {
                    // Best effort — if rollback fails, orphan is invisible (no team scope)
                }
            }
            setFormError(error.message || 'An error occurred');
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            setShowConfirmationModal(false);
        } finally {
            setSaving(false);
        }
    }, [validateForm, policyId, policyName, expression, originalExpression, channelChanges, policyActiveStatusChanges, actions, abacActions, teamId, onNavigateBack, formatMessage]);

    const handleSaveChanges = useCallback(async () => {
        setFormError('');
        if (!await validateForm()) {
            return;
        }
        const hasRuleOrChannelChanges = expression !== originalExpression ||
            Object.keys(channelChanges.added).length > 0 ||
            channelChanges.removedCount > 0 ||
            policyActiveStatusChanges.length > 0 ||
            !policyId;
        if (hasRuleOrChannelChanges) {
            setShowConfirmationModal(true);
        } else {
            await handleSave();
        }
    }, [validateForm, expression, originalExpression, channelChanges, policyActiveStatusChanges, policyId, handleSave]);

    const handleCancel = useCallback(() => {
        setPolicyName(originalName);
        setExpression(originalExpression);
        setChannelChanges({removed: {}, added: {}, removedCount: 0});
        setPolicyActiveStatusChanges([]);
        setFormError('');
        setSaveChangesPanelState(undefined);
        if (backClicked) {
            onNavigateBack();
        }
        setBackClicked(false);
    }, [originalName, originalExpression, backClicked, onNavigateBack]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
        setBackClicked(false);
    }, []);

    // Delete flow
    const handleDelete = useCallback(async () => {
        if (!policyId) {
            return;
        }
        setShowDeleteModal(false);
        try {
            // Unassign locally-removed channels first so child policies are deleted
            if (channelChanges.removedCount > 0) {
                const unassignResult = await actions.unassignChannelsFromAccessControlPolicy(policyId, Object.keys(channelChanges.removed));
                if (unassignResult.error?.server_error_id) {
                    throw new Error(unassignResult.error.message || 'Failed to unassign channels');
                }
            }
            const result = await actions.deletePolicy(policyId);
            if (result.error?.server_error_id) {
                throw new Error(result.error.message || 'Failed to delete policy');
            }
            onNavigateBack(formatMessage({id: 'team_settings.policy_editor.policy_deleted', defaultMessage: 'Policy deleted'}));
        } catch (error: any) {
            setFormError(error.message || 'Error deleting policy');
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
        }
    }, [policyId, actions, onNavigateBack, channelChanges, formatMessage]);

    const hasErrors = formError.length > 0;
    const nameHasError = hasErrors && policyName.length === 0;
    const nameErrorMessage: CustomMessageInputType = nameHasError ? {type: 'error', value: formatMessage({id: 'team_settings.policy_editor.name_required', defaultMessage: 'A policy name is required.'})} : null;

    return (
        <div className='TeamPolicyEditor'>
            <div className='TeamPolicyEditor__header'>
                <button
                    className='style--none TeamPolicyEditor__back-btn'
                    onClick={() => {
                        if (hasUnsavedChanges) {
                            setBackClicked(true);
                        } else {
                            onNavigateBack();
                        }
                    }}
                >
                    <i className='icon icon-arrow-left'/>
                    <FormattedMessage
                        id={policyId ? 'team_settings.policy_editor.edit_title' : 'team_settings.policy_editor.add_title'}
                        defaultMessage={policyId ? 'Edit membership policy' : 'Add membership policy'}
                    />
                </button>
            </div>

            <hr className='TeamPolicyEditor__divider TeamPolicyEditor__divider--full-width header-divider'/>

            <div className='TeamPolicyEditor__name-input'>
                <Input
                    name='policyName'
                    type='text'
                    value={policyName}
                    label={formatMessage({id: 'team_settings.policy_editor.name_label', defaultMessage: 'Membership policy name'})}
                    placeholder={formatMessage({id: 'team_settings.policy_editor.name_placeholder', defaultMessage: 'Add a unique policy name'})}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        setPolicyName(e.target.value);
                        if (formError) {
                            setFormError('');
                            setSaveChangesPanelState(undefined);
                        }
                    }}
                    maxLength={64}
                    limit={64}
                    autoFocus={!policyId}
                    required={true}
                    hasError={nameHasError}
                    customMessage={nameErrorMessage}
                />
                <p className={`TeamPolicyEditor__name-hint${nameHasError ? ' TeamPolicyEditor__name-hint--error' : ''}`}>
                    <FormattedMessage
                        id='team_settings.policy_editor.name_hint'
                        defaultMessage='Give your policy a name that will be used to identify it in the policies list.'
                    />
                </p>
            </div>

            <hr className='TeamPolicyEditor__divider'/>

            <div className='TeamPolicyEditor__section'>
                <div className='TeamPolicyEditor__section-header'>
                    <div>
                        <h4 className='TeamPolicyEditor__section-title'>
                            <FormattedMessage
                                id='team_settings.policy_editor.rules_title'
                                defaultMessage='Membership rules'
                            />
                        </h4>
                        <p className='TeamPolicyEditor__section-subtitle'>
                            <FormattedMessage
                                id='team_settings.policy_editor.rules_subtitle'
                                defaultMessage='Select user attributes and values as rules for membership'
                            />
                        </p>
                    </div>
                </div>
                <TableEditor
                    value={expression}
                    onChange={handleExpressionChange}
                    onValidate={() => {}}
                    disabled={noUsableAttributes}
                    userAttributes={autocompleteResult}
                    onParseError={() => {}}
                    enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                    actions={abacActions}
                    teamId={teamId}
                    isSystemAdmin={false}

                    // Suppress the live "you would be excluded" banner when
                    // the policy applies only to public channels — there's
                    // nothing to be excluded from in advisory mode, so the
                    // warning is misleading.
                    validateExpressionAgainstRequester={hasPrivateChannelInScope() ? abacActions.validateExpressionAgainstRequester : undefined}
                />
            </div>

            <hr className='TeamPolicyEditor__divider'/>

            <div className='TeamPolicyEditor__section'>
                <div className='TeamPolicyEditor__section-header'>
                    <div>
                        <h4 className='TeamPolicyEditor__section-title'>
                            <FormattedMessage
                                id='admin.access_control.policy.edit_policy.channel_selector.title'
                                defaultMessage='Assigned channels'
                            />
                        </h4>
                        <p className='TeamPolicyEditor__section-subtitle'>
                            <FormattedMessage
                                id='team_settings.policy_editor.channel_selector.subtitle'
                                defaultMessage='Add channels that this membership policy will apply to.'
                            />
                        </p>
                    </div>
                    <button
                        className='btn btn-primary'
                        onClick={() => setAddChannelOpen(true)}
                    >
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.channel_selector.addChannels'
                            defaultMessage='Add channels'
                        />
                    </button>
                </div>
                <ChannelList
                    onRemoveCallback={addToRemovedChannels}
                    channelsToRemove={channelChanges.removed}
                    channelsToAdd={channelChanges.added}
                    policyId={policyId}
                    policyActiveStatusChanges={policyActiveStatusChanges}
                    onPolicyActiveStatusChange={setPolicyActiveStatusChanges}
                    saving={saving}
                    hideTeamColumn={true}
                    teamId={teamId}
                />
            </div>

            {policyId && (
                <>
                    <hr className='TeamPolicyEditor__divider'/>
                    <div className='TeamPolicyEditor__section TeamPolicyEditor__section--delete'>
                        <div className='TeamPolicyEditor__section-header'>
                            <div>
                                <h4 className='TeamPolicyEditor__section-title'>
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.delete_policy.title'
                                        defaultMessage='Delete policy'
                                    />
                                </h4>
                                <p className='TeamPolicyEditor__section-subtitle'>
                                    {hasChannels() ? (
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.delete_policy.subtitle.has_resources'
                                            defaultMessage='Remove all assigned resources (eg. Channels) to be able to delete this policy'
                                        />
                                    ) : (
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.delete_policy.subtitle'
                                            defaultMessage='This policy will be deleted and cannot be recovered.'
                                        />
                                    )}
                                </p>
                            </div>
                            <button
                                className='btn btn-danger'
                                onClick={() => setShowDeleteModal(true)}
                                disabled={hasChannels()}
                            >
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.delete_policy.delete'
                                    defaultMessage='Delete'
                                />
                            </button>
                        </div>
                    </div>
                </>
            )}

            {addChannelOpen && (
                <ChannelSelectorModal
                    onModalDismissed={() => setAddChannelOpen(false)}
                    onChannelsSelected={addToNewChannels}
                    groupID=''
                    alreadySelected={[...savedChannelIds, ...Object.keys(channelChanges.added)].filter((id) => !channelChanges.removed[id])}
                    excludeTypes={['D', 'G']}
                    excludeGroupConstrained={true}
                    excludeDefaultChannels={true}
                    teamId={teamId}
                    excludeRemote={Boolean(teamId)}
                    isStacked={true}
                />
            )}

            {showConfirmationModal && (
                <TeamPolicyConfirmationModal
                    onExited={() => setShowConfirmationModal(false)}
                    onConfirm={handleSave}
                    channelsAffected={confirmationChannelCounts.channelsAffected}
                    publicChannelsAffected={confirmationChannelCounts.publicCount}
                    privateChannelsAffected={confirmationChannelCounts.privateCount}
                    saving={saving}
                />
            )}

            {showDeleteModal && (
                <GenericModal
                    className='TeamPolicyEditor__delete-modal'
                    show={true}
                    isStacked={true}
                    onExited={() => setShowDeleteModal(false)}
                    onHide={() => setShowDeleteModal(false)}
                    compassDesign={true}
                    modalHeaderText={
                        <FormattedMessage
                            id='team_settings.policy_editor.delete_confirmation.title'
                            defaultMessage='Delete policy {name}'
                            values={{name: policyName}}
                        />
                    }
                    footerContent={
                        <div className='TeamPolicyEditor__delete-modal-footer'>
                            <button
                                type='button'
                                className='btn btn-tertiary'
                                onClick={() => setShowDeleteModal(false)}
                            >
                                {formatMessage({id: 'team_settings.policy_editor.delete_confirmation.cancel', defaultMessage: 'Cancel'})}
                            </button>
                            <button
                                type='button'
                                className='btn btn-danger'
                                onClick={handleDelete}
                            >
                                {formatMessage({id: 'team_settings.policy_editor.delete_confirmation.confirm', defaultMessage: 'Delete'})}
                            </button>
                        </div>
                    }
                >
                    <p>
                        <FormattedMessage
                            id='team_settings.policy_editor.delete_confirmation.body'
                            defaultMessage='This action cannot be undone.'
                        />
                    </p>
                </GenericModal>
            )}

            {(shouldShowPanel || backClicked) && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={backClicked || hasErrors || showTabSwitchError || (!hasChannels() && Boolean(policyId))}
                    state={backClicked || hasErrors || showTabSwitchError || (!hasChannels() && Boolean(policyId)) ? SAVE_RESULT_ERROR : saveChangesPanelState}
                    customErrorMessage={!hasChannels() && policyId ? formatMessage({id: 'team_settings.policy_editor.error.no_channels_delete_hint', defaultMessage: 'Remove all channels to delete, or undo to keep the policy.'}) : (formError || undefined)}
                    cancelButtonText={formatMessage({id: 'team_settings.policy_editor.undo', defaultMessage: 'Undo'})}
                />
            )}
        </div>
    );
}
