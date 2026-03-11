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

import CELEditor from 'components/admin_console/access_control/editors/cel_editor/editor';
import {hasUsableAttributes} from 'components/admin_console/access_control/editors/shared';
import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import ChannelList from 'components/admin_console/access_control/policy_details/channel_list';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import ChannelSelectorModal from 'components/channel_selector_modal';
import Input from 'components/widgets/inputs/input/input';
import type {CustomMessageInputType} from 'components/widgets/inputs/input/input';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import TeamPolicyConfirmationModal from './team_policy_confirmation_modal';

import './team_policy_editor.scss';

const SAVE_RESULT_SAVED = 'saved' as const;
const SAVE_RESULT_ERROR = 'error' as const;
const DEFAULT_PAGE_SIZE = 10;

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
    onNavigateBack: () => void;
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

    // Editor mode
    const [editorMode, setEditorMode] = useState<'cel' | 'table'>('table');

    // Channel state
    const [channelChanges, setChannelChanges] = useState<ChannelChanges>({removed: {}, added: {}, removedCount: 0});
    const [policyActiveStatusChanges, setPolicyActiveStatusChanges] = useState<PolicyActiveStatus[]>([]);
    const [channelsCount, setChannelsCount] = useState(0);
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
        actions.searchChannels(policyId, '', {per_page: DEFAULT_PAGE_SIZE}).then((result) => {
            setChannelsCount(result.data?.total_count || 0);
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
        return (channelsCount - channelChanges.removedCount + Object.keys(channelChanges.added).length) > 0;
    }, [channelsCount, channelChanges]);

    // Expression mode switching
    const isSimpleExpression = (expr: string): boolean => {
        if (!expr) {
            return true;
        }
        return expr.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*(==|!=)\s*['"][^'"]*['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/) ||
                   trimmed.match(/^((\[.*?\])||['"][^'"]*['"].*?)\s+in\s+user\.attributes\.\w+$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.startsWith\(['"][^'"]*['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.endsWith\(['"][^'"]*['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.contains\(['"][^'"]*['"].*?\)$/);
        });
    };

    // Validation
    const validateForm = useCallback(() => {
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
        return true;
    }, [policyName, expression, hasChannels, formatMessage]);

    // Save flow
    const handleSave = useCallback(async () => {
        if (!validateForm()) {
            return;
        }

        setSaving(true);
        try {
            let currentPolicyId = policyId;

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
            // only throw on errors that have a server_error_id (actual API errors),
            // not on response parsing issues.
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

            // Always trigger sync on save
            await abacActions.createAccessControlSyncJob({policy_id: currentPolicyId, team_id: teamId});

            setShowConfirmationModal(false);
            onNavigateBack();
        } catch (error: any) {
            setFormError(error.message || 'An error occurred');
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            setShowConfirmationModal(false);
        } finally {
            setSaving(false);
        }
    }, [validateForm, policyId, policyName, expression, channelChanges, policyActiveStatusChanges, actions, abacActions, teamId, onNavigateBack]);

    const handleSaveChanges = useCallback(async () => {
        setFormError('');
        if (!validateForm()) {
            return;
        }
        setShowConfirmationModal(true);
    }, [validateForm]);

    const handleCancel = useCallback(() => {
        setPolicyName(originalName);
        setExpression(originalExpression);
        setChannelChanges({removed: {}, added: {}, removedCount: 0});
        setPolicyActiveStatusChanges([]);
        setFormError('');
        setSaveChangesPanelState(undefined);
    }, [originalName, originalExpression]);

    const handleClose = useCallback(() => {
        setSaveChangesPanelState(undefined);
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
            onNavigateBack();
        } catch (error: any) {
            setFormError(error.message || 'Error deleting policy');
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
        }
    }, [policyId, actions, onNavigateBack, channelChanges]);

    const filteredAttributes = useMemo(() => {
        return autocompleteResult.filter((attr) => {
            if (accessControlSettings.EnableUserManagedAttributes) {
                return true;
            }
            const isSynced = attr.attrs?.ldap || attr.attrs?.saml;
            const isAdminManaged = attr.attrs?.managed === 'admin';
            const isProtected = attr.attrs?.protected;
            return isSynced || isAdminManaged || isProtected;
        }).map((attr) => ({attribute: attr.name, values: []}));
    }, [autocompleteResult, accessControlSettings.EnableUserManagedAttributes]);

    const hasErrors = formError.length > 0;
    const nameHasError = hasErrors && policyName.length === 0;
    const nameErrorMessage: CustomMessageInputType = nameHasError ? {type: 'error', value: formatMessage({id: 'team_settings.policy_editor.name_required', defaultMessage: 'A policy name is required.'})} : null;

    return (
        <div className='TeamPolicyEditor'>
            <div className='TeamPolicyEditor__header'>
                <button
                    className='style--none TeamPolicyEditor__back-btn'
                    onClick={onNavigateBack}
                >
                    <i className='fa fa-angle-left'/>
                    <FormattedMessage
                        id={policyId ? 'team_settings.policy_editor.edit_title' : 'team_settings.policy_editor.add_title'}
                        defaultMessage={policyId ? 'Edit Access Policy' : 'Create Access Policy'}
                    />
                </button>
            </div>

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

            <Card
                expanded={true}
                className='TeamPolicyEditor__card'
            >
                <Card.Header>
                    <TitleAndButtonCardHeader
                        title={
                            <FormattedMessage
                                id='team_settings.policy_editor.rules_title'
                                defaultMessage='Access rules'
                            />
                        }
                        subtitle={
                            <FormattedMessage
                                id='team_settings.policy_editor.rules_subtitle'
                                defaultMessage='Select user attributes and values as rules to restrict access.'
                            />
                        }
                        buttonText={
                            editorMode === 'table' ? (
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.switch_to_advanced'
                                    defaultMessage='Switch to Advanced Mode'
                                />
                            ) : (
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.switch_to_simple'
                                    defaultMessage='Switch to Simple Mode'
                                />
                            )
                        }
                        onClick={() => setEditorMode(editorMode === 'table' ? 'cel' : 'table')}
                        isDisabled={noUsableAttributes || (editorMode === 'cel' && !isSimpleExpression(expression))}
                    />
                </Card.Header>
                <Card.Body>
                    {editorMode === 'cel' ? (
                        <CELEditor
                            value={expression}
                            onChange={handleExpressionChange}
                            onValidate={() => {}}
                            disabled={noUsableAttributes}
                            teamId={teamId}
                            userAttributes={filteredAttributes}
                        />
                    ) : (
                        <TableEditor
                            value={expression}
                            onChange={handleExpressionChange}
                            onValidate={() => {}}
                            disabled={noUsableAttributes}
                            userAttributes={autocompleteResult}
                            onParseError={() => setEditorMode('cel')}
                            enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                            actions={abacActions}
                            teamId={teamId}
                            isSystemAdmin={false}
                            validateExpressionAgainstRequester={abacActions.validateExpressionAgainstRequester}
                        />
                    )}
                </Card.Body>
            </Card>

            <Card
                expanded={true}
                className='TeamPolicyEditor__card'
            >
                <Card.Header>
                    <TitleAndButtonCardHeader
                        title={<FormattedMessage
                            id='admin.access_control.policy.edit_policy.channel_selector.title'
                            defaultMessage='Assigned channels'
                               />}
                        subtitle={<FormattedMessage
                            id='admin.access_control.policy.edit_policy.channel_selector.subtitle'
                            defaultMessage='Add channels that this attribute-based access policy will apply to.'
                                  />}
                        buttonText={<FormattedMessage
                            id='admin.access_control.policy.edit_policy.channel_selector.addChannels'
                            defaultMessage='Add channels'
                                    />}
                        onClick={() => setAddChannelOpen(true)}
                    />
                </Card.Header>
                <Card.Body expanded={true}>
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
                </Card.Body>
            </Card>

            {policyId && (
                <Card
                    expanded={true}
                    className='TeamPolicyEditor__card TeamPolicyEditor__delete-section'
                >
                    <Card.Header>
                        <TitleAndButtonCardHeader
                            title={<FormattedMessage
                                id='admin.access_control.policy.edit_policy.delete_policy.title'
                                defaultMessage='Delete policy'
                                   />}
                            subtitle={
                                hasChannels() ? (
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.delete_policy.subtitle.has_resources'
                                        defaultMessage='Remove all assigned resources (eg. Channels) to be able to delete this policy'
                                    />
                                ) : (
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.delete_policy.subtitle'
                                        defaultMessage='This policy will be deleted and cannot be recovered.'
                                    />
                                )
                            }
                            buttonText={<FormattedMessage
                                id='admin.access_control.policy.edit_policy.delete_policy.delete'
                                defaultMessage='Delete'
                                        />}
                            onClick={() => (hasChannels() ? undefined : setShowDeleteModal(true))}
                            isDisabled={hasChannels()}
                        />
                    </Card.Header>
                </Card>
            )}

            {addChannelOpen && (
                <ChannelSelectorModal
                    onModalDismissed={() => setAddChannelOpen(false)}
                    onChannelsSelected={addToNewChannels}
                    groupID=''
                    alreadySelected={Object.values(channelChanges.added).map((ch) => ch.id)}
                    excludeTypes={['O', 'D', 'G']}
                    excludeGroupConstrained={true}
                    teamId={teamId}
                />
            )}

            {showConfirmationModal && (
                <TeamPolicyConfirmationModal
                    onExited={() => setShowConfirmationModal(false)}
                    onConfirm={handleSave}
                    channelsAffected={(channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length}
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

            {shouldShowPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors || showTabSwitchError}
                    state={hasErrors || showTabSwitchError ? SAVE_RESULT_ERROR : saveChangesPanelState}
                    customErrorMessage={formError || undefined}
                    cancelButtonText={formatMessage({
                        id: 'team_settings.policy_editor.undo',
                        defaultMessage: 'Undo',
                    })}
                />
            )}
        </div>
    );
}
