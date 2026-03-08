// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React, {useState, useEffect, useMemo, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyActiveUpdate, AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {AccessControlSettings} from '@mattermost/types/config';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {UserPropertyField} from '@mattermost/types/properties';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {Client4} from 'mattermost-redux/client';

import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import ChannelSelectorModal from 'components/channel_selector_modal';
import SaveChangesPanel from 'components/widgets/modals/components/save_changes_panel';
import type {SaveChangesPanelState} from 'components/widgets/modals/components/save_changes_panel';

import {useChannelAccessControlActions} from 'hooks/useChannelAccessControlActions';

import ChannelList from 'components/admin_console/access_control/policy_details/channel_list';
import CELEditor from 'components/admin_console/access_control/editors/cel_editor/editor';
import {hasUsableAttributes} from 'components/admin_console/access_control/editors/shared';
import TableEditor from 'components/admin_console/access_control/editors/table_editor/table_editor';
import PolicyConfirmationModal from 'components/admin_console/access_control/modals/confirmation/confirmation_modal';

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
    const abacActions = useChannelAccessControlActions();

    // Policy state
    const [policyName, setPolicyName] = useState('');
    const [originalName, setOriginalName] = useState('');
    const [expression, setExpression] = useState('');
    const [originalExpression, setOriginalExpression] = useState('');
    const [autoSyncMembership, setAutoSyncMembership] = useState(false);

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

    const noUsableAttributes = attributesLoaded && !hasUsableAttributes(autocompleteResult, accessControlSettings.EnableUserManagedAttributes);

    // Load attributes on mount
    useEffect(() => {
        Client4.getAccessControlFields('', 100, undefined, teamId).then((data) => {
            setAutocompleteResult(data);
            setAttributesLoaded(true);
        }).catch(() => {
            setAttributesLoaded(true);
        });
    }, [teamId]);

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
                setAutoSyncMembership(result.data.active || false);
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
        return hasUnsavedChanges || saveChangesPanelState === SAVE_RESULT_SAVED;
    }, [hasUnsavedChanges, saveChangesPanelState]);

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
    }, []);

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

    // Save flow
    const handleSave = useCallback(async (apply = false) => {
        if (policyName.length === 0) {
            setFormError(formatMessage({id: 'admin.access_control.policy.edit_policy.error.name_required', defaultMessage: 'Please add a name to the policy'}));
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
            return;
        }
        if (expression.length === 0) {
            setFormError(formatMessage({id: 'admin.access_control.policy.edit_policy.error.expression_required', defaultMessage: 'Please add an expression to the policy'}));
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
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
            if (channelChanges.removedCount > 0) {
                await actions.unassignChannelsFromAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.removed));
            }
            if (Object.keys(channelChanges.added).length > 0) {
                await actions.assignChannelsToAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.added));
            }

            // Update active status
            if (policyActiveStatusChanges.length > 0) {
                await actions.updateAccessControlPoliciesActive(policyActiveStatusChanges);
            }

            // Trigger sync job if needed
            if (apply) {
                await abacActions.createAccessControlSyncJob({policy_id: currentPolicyId});
            }

            // Update originals
            setOriginalName(policyName);
            setOriginalExpression(expression);
            setChannelChanges({removed: {}, added: {}, removedCount: 0});
            setPolicyActiveStatusChanges([]);
            setShowConfirmationModal(false);

            setSaveChangesPanelState(SAVE_RESULT_SAVED);
        } catch (error: any) {
            setFormError(error.message || 'An error occurred');
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
        } finally {
            setSaving(false);
        }
    }, [policyId, policyName, expression, channelChanges, policyActiveStatusChanges, actions, abacActions, formatMessage]);

    const handleSaveChanges = useCallback(async () => {
        setFormError('');
        if (hasChannels()) {
            setShowConfirmationModal(true);
        } else {
            await handleSave();
        }
    }, [handleSave, hasChannels]);

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
        try {
            await actions.deletePolicy(policyId);
            onNavigateBack();
        } catch (error: any) {
            setFormError(error.message || 'Error deleting policy');
            setSaveChangesPanelState(SAVE_RESULT_ERROR);
        }
    }, [policyId, actions, onNavigateBack]);

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
                        defaultMessage={policyId ? 'Edit access policy' : 'Add access policy'}
                    />
                </button>
            </div>

            <div className='TeamPolicyEditor__name-input'>
                <label htmlFor='policyName'>
                    <FormattedMessage
                        id='team_settings.policy_editor.name_label'
                        defaultMessage='Access policy name'
                    />
                </label>
                <input
                    id='policyName'
                    type='text'
                    className={`form-control${hasErrors && policyName.length === 0 ? ' has-error' : ''}`}
                    value={policyName}
                    placeholder={formatMessage({id: 'team_settings.policy_editor.name_placeholder', defaultMessage: 'Add a unique policy name'})}
                    onChange={(e) => setPolicyName(e.target.value)}
                    autoFocus={!policyId}
                />
                <p className='TeamPolicyEditor__name-hint'>
                    <FormattedMessage
                        id='team_settings.policy_editor.name_hint'
                        defaultMessage='Give your policy a name that will be used to identify it in the policies list.'
                    />
                </p>
            </div>

            <Card expanded={true} className='console'>
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
                                <FormattedMessage id='admin.access_control.policy.edit_policy.switch_to_advanced' defaultMessage='Switch to Advanced Mode'/>
                            ) : (
                                <FormattedMessage id='admin.access_control.policy.edit_policy.switch_to_simple' defaultMessage='Switch to Simple Mode'/>
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
                            onChange={setExpression}
                            onValidate={() => {}}
                            disabled={noUsableAttributes}
                            userAttributes={filteredAttributes}
                        />
                    ) : (
                        <TableEditor
                            value={expression}
                            onChange={setExpression}
                            onValidate={() => {}}
                            disabled={noUsableAttributes}
                            userAttributes={autocompleteResult}
                            onParseError={() => setEditorMode('cel')}
                            enableUserManagedAttributes={accessControlSettings.EnableUserManagedAttributes}
                            actions={abacActions}
                            isSystemAdmin={false}
                            validateExpressionAgainstRequester={abacActions.validateExpressionAgainstRequester}
                        />
                    )}
                </Card.Body>
            </Card>

            <Card expanded={true} className='console add-channels'>
                <Card.Header>
                    <TitleAndButtonCardHeader
                        title={<FormattedMessage id='admin.access_control.policy.edit_policy.channel_selector.title' defaultMessage='Assigned channels'/>}
                        subtitle={<FormattedMessage id='admin.access_control.policy.edit_policy.channel_selector.subtitle' defaultMessage='Add channels that this attribute-based access policy will apply to.'/>}
                        buttonText={<FormattedMessage id='admin.access_control.policy.edit_policy.channel_selector.addChannels' defaultMessage='Add channels'/>}
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
                    />
                </Card.Body>
            </Card>

            {policyId && (
                <Card expanded={true} className='console delete-policy'>
                    <Card.Header>
                        <TitleAndButtonCardHeader
                            title={<FormattedMessage id='admin.access_control.policy.edit_policy.delete_policy.title' defaultMessage='Delete policy'/>}
                            subtitle={
                                hasChannels() ? (
                                    <FormattedMessage id='admin.access_control.policy.edit_policy.delete_policy.subtitle.has_resources' defaultMessage='Remove all assigned resources (eg. Channels) to be able to delete this policy'/>
                                ) : (
                                    <FormattedMessage id='admin.access_control.policy.edit_policy.delete_policy.subtitle' defaultMessage='This policy will be deleted and cannot be recovered.'/>
                                )
                            }
                            buttonText={<FormattedMessage id='admin.access_control.policy.edit_policy.delete_policy.delete' defaultMessage='Delete'/>}
                            onClick={() => hasChannels() ? undefined : handleDelete()}
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
                <PolicyConfirmationModal
                    active={autoSyncMembership}
                    onExited={() => setShowConfirmationModal(false)}
                    onConfirm={handleSave}
                    channelsAffected={(channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length}
                />
            )}

            {shouldShowPanel && (
                <SaveChangesPanel
                    handleSubmit={handleSaveChanges}
                    handleCancel={handleCancel}
                    handleClose={handleClose}
                    tabChangeError={hasErrors}
                    state={hasErrors ? SAVE_RESULT_ERROR : saveChangesPanelState}
                    customErrorMessage={formError || (showTabSwitchError ? undefined : formatMessage({
                        id: 'team_settings.policy_editor.form_error',
                        defaultMessage: 'There are errors in the fields above',
                    }))}
                    cancelButtonText={formatMessage({
                        id: 'team_settings.policy_editor.undo',
                        defaultMessage: 'Undo',
                    })}
                />
            )}
        </div>
    );
}
