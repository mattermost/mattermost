// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import cloneDeep from 'lodash/cloneDeep';
import React, {useState, useEffect} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {GenericModal} from '@mattermost/components';
import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/access_control';
import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';
import type {JobTypeBase} from '@mattermost/types/jobs';
import type {PropertyField} from '@mattermost/types/properties';

import type {ActionResult} from 'mattermost-redux/types/actions';

import BlockableLink from 'components/admin_console/blockable_link';
import BooleanSetting from 'components/admin_console/boolean_setting';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import ChannelSelectorModal from 'components/channel_selector_modal';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';

import {getHistory} from 'utils/browser_history';
import {JobTypes} from 'utils/constants';

import ChannelList from './channel_list';

import CELEditor from '../editors/cel_editor/editor';
import TableEditor from '../editors/table_editor/table_editor';
import PolicyConfirmationModal from '../modals/confirmation/confirmation_modal';

import './policy_details.scss';

const DEFAULT_PAGE_SIZE = 10;

interface PolicyActions {
    fetchPolicy: (id: string) => Promise<ActionResult>;
    createPolicy: (policy: AccessControlPolicy) => Promise<ActionResult>;
    deletePolicy: (id: string) => Promise<ActionResult>;
    searchChannels: (id: string, term: string, opts: ChannelSearchOpts) => Promise<ActionResult>;
    setNavigationBlocked: (blocked: boolean) => void;
    assignChannelsToAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    unassignChannelsFromAccessControlPolicy: (policyId: string, channelIds: string[]) => Promise<ActionResult>;
    getAccessControlFields: (after: string, limit: number) => Promise<ActionResult>;
    createJob: (job: JobTypeBase & { data: any }) => Promise<ActionResult>;
    updateAccessControlPolicyActive: (policyId: string, active: boolean) => Promise<ActionResult>;
}

export interface PolicyDetailsProps {
    policy?: AccessControlPolicy;
    policyId?: string;
    actions: PolicyActions;
}

interface ChannelChanges {
    removed: Record<string, ChannelWithTeamData>;
    added: Record<string, ChannelWithTeamData>;
    removedCount: number;
}

function PolicyDetails({
    policy,
    policyId,
    actions,
}: PolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState(policy?.name || '');
    const [expression, setExpression] = useState(policy?.rules?.[0]?.expression || '');
    const [autoSyncMembership, setAutoSyncMembership] = useState(policy?.active || false);
    const [serverError, setServerError] = useState<string | undefined>(undefined);
    const [addChannelOpen, setAddChannelOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'cel' | 'table'>('table');
    const [channelChanges, setChannelChanges] = useState<ChannelChanges>({
        removed: {},
        added: {},
        removedCount: 0,
    });
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [channelsCount, setChannelsCount] = useState(0);
    const [autocompleteResult, setAutocompleteResult] = useState<PropertyField[]>([]);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
    const {formatMessage} = useIntl();
    useEffect(() => {
        loadPage();
    }, [policyId]);

    // Check if expression is simple enough for table mode
    const isSimpleExpression = (expr: string): boolean => {
        if (!expr) {
            return true;
        }

        // Expression is simple if it only contains user.attributes.X == "Y" or user.attributes.X in ["Y", "Z"]
        // or user.attributes.X.startsWith/endsWith/contains("Y")
        return expr.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*(==|!=)\s*['"][^'"]+['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.startsWith\(['"][^'"]+['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.endsWith\(['"][^'"]+['"].*?\)$/) ||
                   trimmed.match(/^user\.attributes\.\w+\.contains\(['"][^'"]+['"].*?\)$/);
        });
    };

    const loadPage = async () => {
        // Fetch autocomplete fields first, as they are general and needed for both new and existing policies.
        const fieldsPromise = actions.getAccessControlFields('', 100).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
        });

        if (policyId) {
            // For existing policies, fetch policy details and channels
            const policyPromise = actions.fetchPolicy(policyId).then((result) => {
                setPolicyName(result.data?.name || '');
                setExpression(result.data?.rules?.[0]?.expression || '');
                setAutoSyncMembership(result.data?.active || false);
            });

            const channelsPromise = actions.searchChannels(policyId, '', {per_page: DEFAULT_PAGE_SIZE}).then((result) => {
                setChannelsCount(result.data?.total_count || 0);
            });

            // Wait for all fetches for an existing policy
            await Promise.all([fieldsPromise, policyPromise, channelsPromise]);
        } else {
            // For new policies, just ensure general fields are fetched.
            // Policy name, expression, etc., are already initialized from props or defaults by useState.
            await fieldsPromise;
        }
    };

    const handleSubmit = async (apply = false) => {
        let success = true;
        let currentPolicyId = policyId;

        // --- Step 1: Create/Update Policy ---
        await actions.createPolicy({
            id: currentPolicyId || '',
            name: policyName,
            rules: [{expression, actions: ['*']}] as AccessControlPolicyRule[],
            type: 'parent',
            version: 'v0.1',
        }).then((result) => {
            if (result.error) {
                setServerError(result.error.message);
                success = false;
                return;
            }
            currentPolicyId = result.data?.id;
            setPolicyName(result.data?.name || '');
            setExpression(result.data?.rules?.[0]?.expression || '');
            setAutoSyncMembership(result.data?.active || false);
        });

        if (!currentPolicyId || !success) {
            return;
        }

        // --- Step 2: Update Policy Active ---
        try {
            await actions.updateAccessControlPolicyActive(currentPolicyId, autoSyncMembership);
        } catch (error) {
            setServerError(`Error updating policy active status: ${error.message}`);
            success = false;
            return;
        }

        // --- Step 3: Assign Channels ---
        if (success) {
            try {
                if (channelChanges.removedCount > 0) {
                    await actions.unassignChannelsFromAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.removed));
                }
                if (Object.keys(channelChanges.added).length > 0) {
                    await actions.assignChannelsToAccessControlPolicy(currentPolicyId, Object.keys(channelChanges.added));
                }

                setChannelChanges({removed: {}, added: {}, removedCount: 0});
            } catch (error) {
                setServerError(`Error assigning channels: ${error.message}`);
                success = false;
                return;
            }
        }

        // --- Step 4: Create Job if necessary ---
        if (apply) {
            try {
                const job: JobTypeBase & { data: any } = {
                    type: JobTypes.ACCESS_CONTROL_SYNC,
                    data: {parent_id: currentPolicyId},
                };
                await actions.createJob(job);
            } catch (error) {
                setServerError(`Error creating job: ${error.message}`);
                success = false;
                return;
            }
        }

        // --- Step 5: Navigate lastly ---
        setSaveNeeded(false);
        setShowConfirmationModal(false);
        actions.setNavigationBlocked(false);
        getHistory().push('/admin_console/user_management/attribute_based_access_control');
    };

    const handleDelete = async () => {
        if (!policyId) {
            return; // Should not happen if delete button is enabled correctly
        }

        let success = true;

        // --- Step 1: Unassign Channels (if necessary) ---
        if (channelChanges.removedCount > 0) {
            try {
                await actions.unassignChannelsFromAccessControlPolicy(policyId, Object.keys(channelChanges.removed));
            } catch (error) {
                setServerError(`Error unassigning channels: ${error.message}`);
                success = false;
            }
        }

        // --- Step 2: Delete Policy and Navigate ---
        if (success) {
            try {
                await actions.deletePolicy(policyId);
            } catch (error) {
                setServerError(`Error deleting policy: ${error.message}`);
            }
        }

        if (success) {
            getHistory().push('/admin_console/user_management/attribute_based_access_control');
        }
    };

    const handleChannelChanges = (channels: ChannelWithTeamData[], isAdding: boolean) => {
        setChannelChanges((prev) => {
            const newChanges = cloneDeep(prev);

            channels.forEach((channel) => {
                if (isAdding) {
                    if (newChanges.removed[channel.id]) {
                        delete newChanges.removed[channel.id];
                        newChanges.removedCount--;
                    } else {
                        newChanges.added[channel.id] = channel;
                    }
                } else if (newChanges.added[channel.id]) {
                    delete newChanges.added[channel.id];
                } else if (!newChanges.removed[channel.id]) {
                    newChanges.removedCount++;
                    newChanges.removed[channel.id] = channel;
                }
            });

            return newChanges;
        });
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
    };

    const handleUndoRemove = (channel: ChannelWithTeamData) => {
        setChannelChanges((prev) => {
            const newChanges = cloneDeep(prev);
            if (newChanges.removed[channel.id]) {
                delete newChanges.removed[channel.id];
                newChanges.removedCount--;
            }
            return newChanges;
        });
        setSaveNeeded(true);
        actions.setNavigationBlocked(true);
    };

    const hasChannels = () => {
        // If there are channels on the server (minus any pending removals) or newly added channels
        return (
            (channelsCount > channelChanges.removedCount) ||
            (Object.keys(channelChanges.added).length > 0)
        );
    };

    return (
        <div className='wrapper--fixed AccessControlPolicySettings'>
            <AdminHeader withBackButton={true}>
                <div>
                    <BlockableLink
                        to='/admin_console/user_management/attribute_based_access_control'
                        className='fa fa-angle-left back'
                    />
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.title'
                        defaultMessage='Edit Access Control Policy'
                    />
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className='admin-console__setting-group'>
                        <TextSetting
                            id='admin.access_control.policy.edit_policy.policyName'
                            label={
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.policyName'
                                    defaultMessage='Access control policy name:'
                                />
                            }
                            value={policyName}
                            placeholder={formatMessage({
                                id: 'admin.access_control.policy.edit_policy.policyName.placeholder',
                                defaultMessage: 'Add a unique policy name',
                            })}
                            onChange={(_, value) => {
                                setPolicyName(value);
                                setSaveNeeded(true);
                            }}
                            labelClassName='col-sm-4 vertically-centered-label'
                            inputClassName='col-sm-8'
                        />
                        <BooleanSetting
                            id='admin.access_control.policy.edit_policy.autoSyncMembership'
                            label={
                                <div className='vertically-centered-label'>
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.autoSyncMembership'
                                        defaultMessage='Auto-add members based on access rules:'
                                    />
                                </div>
                            }
                            value={autoSyncMembership}
                            onChange={(_, value) => {
                                setAutoSyncMembership(value);
                                setSaveNeeded(true);
                            }}
                            setByEnv={false}
                            helpText={
                                <FormattedMessage
                                    id='admin.access_control.policy.edit_policy.autoSyncMembership.description'
                                    defaultMessage='Users who match the attribute values configured below will be automatically added as new members. Regardless of this setting, users who later no longer match the configured attribute values will be removed from the channel after the next sync.'
                                />
                            }
                        />
                    </div>

                    <Card
                        expanded={true}
                        className={'console'}
                    >
                        <Card.Header>
                            <TitleAndButtonCardHeader
                                title={'Attribute based access rules'}
                                subtitle={'Select user attributes and values as rules to restrict channel membership.'}
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
                                isDisabled={editorMode === 'cel' && !isSimpleExpression(expression)}
                                tooltipText={
                                    editorMode === 'cel' && !isSimpleExpression(expression) ?
                                        'Complex expression detected. Simple expressions editor is not available at the moment.' :
                                        undefined
                                }
                            />
                        </Card.Header>
                        <Card.Body>
                            {editorMode === 'cel' ? (
                                <CELEditor
                                    value={expression}
                                    onChange={(value) => {
                                        setExpression(value);
                                        setSaveNeeded(true);
                                    }}
                                    onValidate={() => {}}
                                    userAttributes={autocompleteResult.map((attr) => ({
                                        attribute: attr.name,
                                        values: [],
                                    }))}
                                />
                            ) : (
                                <TableEditor
                                    value={expression}
                                    onChange={(value) => {
                                        setExpression(value);
                                        setSaveNeeded(true);
                                    }}
                                    onValidate={() => {}}
                                    userAttributes={autocompleteResult.map((attr) => ({
                                        attribute: attr.name,
                                        values: [],
                                    }))}
                                />
                            )}
                        </Card.Body>
                    </Card>

                    <Card
                        expanded={true}
                        className={'console add-channels'}
                    >
                        <Card.Header>
                            <TitleAndButtonCardHeader
                                title={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.channel_selector.title'
                                        defaultMessage='Assigned channels'
                                    />
                                }
                                subtitle={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.channel_selector.subtitle'
                                        defaultMessage='Add channels that this property based access policy will apply to.'
                                    />
                                }
                                buttonText={
                                    <FormattedMessage
                                        id='admin.access_control.policy.edit_policy.channel_selector.addChannels'
                                        defaultMessage='Add channels'
                                    />
                                }
                                onClick={() => setAddChannelOpen(true)}
                            />
                        </Card.Header>
                        <Card.Body expanded={true}>
                            <ChannelList
                                onRemoveCallback={(channel) => handleChannelChanges([channel], false)}
                                onUndoRemoveCallback={handleUndoRemove}
                                channelsToRemove={channelChanges.removed}
                                channelsToAdd={channelChanges.added}
                                policyId={policyId}
                            />
                        </Card.Body>
                    </Card>
                    {policyId && (
                        <Card
                            expanded={true}
                            className={'console delete-policy'}
                        >
                            <Card.Header>
                                <TitleAndButtonCardHeader
                                    title={
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.delete_policy.title'
                                            defaultMessage='Delete policy'
                                        />
                                    }
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
                                    buttonText={
                                        <FormattedMessage
                                            id='admin.access_control.policy.edit_policy.delete_policy.delete'
                                            defaultMessage='Delete'
                                        />
                                    }
                                    onClick={() => {
                                        if (hasChannels()) {
                                            return;
                                        }
                                        setShowDeleteConfirmationModal(true);
                                    }}
                                    isDisabled={hasChannels()}
                                />
                            </Card.Header>
                        </Card>
                    )}
                </div>
            </div>

            {addChannelOpen && (
                <ChannelSelectorModal
                    onModalDismissed={() => setAddChannelOpen(false)}
                    onChannelsSelected={(channels) => handleChannelChanges(channels, true)}
                    groupID={''}
                    alreadySelected={Object.values(channelChanges.added).map((channel) => channel.id)}
                    excludeAccessControlPolicyEnforced={true}
                    excludeTypes={['O', 'D', 'G']}
                />
            )}

            {showConfirmationModal && (
                <PolicyConfirmationModal
                    active={autoSyncMembership}
                    onExited={() => setShowConfirmationModal(false)}
                    onConfirm={handleSubmit}
                    channelsAffected={(channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length}
                />
            )}

            {showDeleteConfirmationModal && (
                <GenericModal
                    onExited={() => setShowDeleteConfirmationModal(false)}
                    handleConfirm={handleDelete}
                    handleCancel={() => setShowDeleteConfirmationModal(false)}
                    modalHeaderText={
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.title'
                            defaultMessage='Confirm Policy Deletion'
                        />
                    }
                    confirmButtonText={
                        <FormattedMessage
                            id='admin.access_control.policy.edit_policy.delete_confirmation.confirm_button'
                            defaultMessage='Delete Policy'
                        />
                    }
                    confirmButtonClassName='btn btn-danger'
                    isDeleteModal={true}
                    compassDesign={true}
                >
                    <FormattedMessage
                        id='admin.access_control.policy.edit_policy.delete_confirmation.message'
                        defaultMessage='Are you sure you want to delete this policy? This action cannot be undone.'
                    />
                </GenericModal>
            )}

            <div className='admin-console-save'>
                <SaveButton
                    disabled={!saveNeeded}
                    onClick={() => {
                        if (hasChannels()) {
                            setShowConfirmationModal(true);
                        } else {
                            handleSubmit();
                        }
                    }}
                    defaultMessage={
                        <FormattedMessage
                            id='admin.access_control.edit_policy.save'
                            defaultMessage='Save'
                        />
                    }
                />
                <BlockableLink
                    className='btn btn-quaternary'
                    to='/admin_console/user_management/attribute_based_access_control'
                >
                    <FormattedMessage
                        id='admin.access_control.edit_policy.cancel'
                        defaultMessage='Cancel'
                    />
                </BlockableLink>
                {serverError && (
                    <span className='EditPolicy__error'>
                        <i className='icon icon-alert-outline'/>
                        <FormattedMessage
                            id='admin.access_control.edit_policy.serverError'
                            defaultMessage='There are errors in the form above: {serverError}'
                            values={{serverError}}
                        />
                    </span>
                )}
            </div>
        </div>
    );
}

export default PolicyDetails;
