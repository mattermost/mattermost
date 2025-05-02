// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/admin';
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
    policyId?: string;
    actions: PolicyActions;
}

interface ChannelChanges {
    removed: Record<string, ChannelWithTeamData>;
    added: Record<string, ChannelWithTeamData>;
    removedCount: number;
}

function PolicyDetails({
    policyId,
    actions,
}: PolicyDetailsProps): JSX.Element {
    const [policyName, setPolicyName] = useState('');
    const [expression, setExpression] = useState('');
    const [autoSyncMembership, setAutoSyncMembership] = useState(false);
    const [serverError, setServerError] = useState(false);
    const [addChannelOpen, setAddChannelOpen] = useState(false);
    const [editorMode, setEditorMode] = useState<'cel' | 'table'>('cel');
    const [channelChanges, setChannelChanges] = useState<ChannelChanges>({
        removed: {},
        added: {},
        removedCount: 0,
    });
    const [saveNeeded, setSaveNeeded] = useState(false);
    const [channelsCount, setChannelsCount] = useState(0);
    const [autocompleteResult, setAutocompleteResult] = useState<PropertyField[]>([]);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);

    useEffect(() => {
        loadPage();
    }, [policyId]);

    // Check if expression is simple enough for table mode
    const isSimpleExpression = (expr: string): boolean => {
        if (!expr) {
            return true;
        }

        // Expression is simple if it only contains user.attributes.X == "Y" or user.attributes.X in ["Y", "Z"]
        return expr.split('&&').every((condition) => {
            const trimmed = condition.trim();
            return trimmed.match(/^user\.attributes\.\w+\s*==\s*['"][^'"]+['"]$/) ||
                   trimmed.match(/^user\.attributes\.\w+\s+in\s+\[.*?\]$/);
        });
    };

    const loadPage = async () => {
        if (!policyId) {
            return;
        }

        await actions.fetchPolicy(policyId).then((result) => {
            if (result.data) {
                // Set policy name and expression after fetching the policy
                setPolicyName(result.data?.name || '');
                setExpression(result.data?.rules?.[0]?.expression || '');
                setAutoSyncMembership(result.data?.active || false);
            }
        });

        // Search for channels after setting the policy details
        await actions.searchChannels(policyId, '', {per_page: DEFAULT_PAGE_SIZE}).then((result) => {
            setChannelsCount(result.data?.total_count || 0);
        });

        await actions.getAccessControlFields('', 100).then((result) => {
            if (result.data) {
                setAutocompleteResult(result.data);
            }
        });
    };

    const handleSubmit = async (apply = false) => {
        let updatedPolicyData: AccessControlPolicy | undefined;
        let success = true;

        // --- Step 1: Create/Update Policy ---
        try {
            const updatedPolicy = await actions.createPolicy({
                id: policyId || '',
                name: policyName,
                rules: [{expression, actions: ['*']}] as AccessControlPolicyRule[],
                type: 'parent',
                version: 'v0.1',
            });
            updatedPolicyData = updatedPolicy.data;
            if (!updatedPolicyData?.id) {
                // Handle case where policy creation might "succeed" but not return an ID needed for subsequent steps
                // ideally this should never happen.
                throw new Error('Policy creation did not return a valid ID.');
            }
        } catch (error) {
            setServerError(true);
            success = false;
        }

        // --- Step 2: Dependent Actions (Channels, Active Status, Job) ---
        if (success && updatedPolicyData?.id) { // ID existence checked in step 1's try
            const policyID = updatedPolicyData.id;
            try {
                await actions.updateAccessControlPolicyActive(policyID, autoSyncMembership);

                if (channelChanges.removedCount > 0) {
                    await actions.unassignChannelsFromAccessControlPolicy(policyID, Object.keys(channelChanges.removed));
                }
                if (Object.keys(channelChanges.added).length > 0) {
                    await actions.assignChannelsToAccessControlPolicy(policyID, Object.keys(channelChanges.added));
                }

                if (apply) {
                    const job: JobTypeBase & { data: any } = {
                        type: JobTypes.ACCESS_CONTROL_SYNC,
                        data: {parent_id: policyID},
                    };
                    await actions.createJob(job);
                }
            } catch (error) {
                setServerError(true);
                success = false;
            }
        }

        // --- Step 3: Navigation & Final State Updates ---
        if (success && updatedPolicyData?.id) {
            try {
                // Navigate first
                getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy/' + encodeURIComponent(updatedPolicyData.id));

                // Then update local state if navigation succeeded
                setChannelChanges({removed: {}, added: {}, removedCount: 0});
                await loadPage(); // Assuming loadPage handles its own errors or failure is acceptable
                setSaveNeeded(false);
                actions.setNavigationBlocked(false);
            } catch (error) {
                setServerError(true);
                success = false;
            }
        }

        // --- Step 4: Always hide modal ---
        setShowConfirmationModal(false);
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
                setServerError(true);
                success = false;
            }
        }

        // --- Step 2: Delete Policy and Navigate ---
        if (success) {
            try {
                const result = await actions.deletePolicy(policyId);
                if (result.data) {
                    // Navigate only if deletion was successful
                    getHistory().push('/admin_console/user_management/attribute_based_access_control');
                } else {
                    // Handle cases where delete action might not throw but indicate failure
                    throw new Error('Policy deletion failed without throwing an error.');
                }
            } catch (error) {
                setServerError(true);
            }
        }
    };

    const handleChannelChanges = (channels: ChannelWithTeamData[], isAdding: boolean) => {
        setChannelChanges((prev) => {
            const newChanges = {...prev};

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
            const newChanges = {...prev};
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
                        id='admin.access_control.policy.editPolicyTitle'
                        defaultMessage='Edit Access Control Policy'
                    />
                </div>
            </AdminHeader>
            <div className='admin-console__wrapper'>
                <div className='admin-console__content'>
                    <div className='admin-console__setting-group'>
                        <TextSetting
                            id='policyName'
                            label='Access control policy name:'
                            value={policyName}
                            onChange={(_, value) => {
                                setPolicyName(value);
                                setSaveNeeded(true);
                            }}
                            labelClassName='col-sm-4'
                            inputClassName='col-sm-8'
                        />
                        <BooleanSetting
                            id='autoSyncMembership'
                            label='Auto-sync membership based on access rules:'
                            value={autoSyncMembership}
                            onChange={(_, value) => setAutoSyncMembership(value)}
                            setByEnv={false}
                            helpText='All users matching the property values configured below will be added as members, and membership will be automatically maintained as user property values change.'
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
                                    })) || []}
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
                                        handleDelete();
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
                    onExited={() => setShowConfirmationModal(false)}
                    onConfirm={handleSubmit}
                    channelsAffected={(channelsCount - channelChanges.removedCount) + Object.keys(channelChanges.added).length}
                />
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
                            defaultMessage='There are errors in the form above'
                        />
                    </span>
                )}
            </div>
        </div>
    );
}

export default PolicyDetails;
