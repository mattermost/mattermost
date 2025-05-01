// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect} from 'react';
import {FormattedMessage} from 'react-intl';

import type {AccessControlExpressionAutocomplete, AccessControlPolicy, AccessControlPolicyRule} from '@mattermost/types/admin';
import type {ChannelSearchOpts, ChannelWithTeamData} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import CELEditor from '../editors/cel_editor/editor';
import ChannelList from './channel_list';
import TableEditor from '../editors/table_editor/table_editor';
import BlockableLink from 'components/admin_console/blockable_link';
import BooleanSetting from 'components/admin_console/boolean_setting';
import Card from 'components/card/card';
import TitleAndButtonCardHeader from 'components/card/title_and_button_card_header/title_and_button_card_header';
import ChannelSelectorModal from 'components/channel_selector_modal';
import SaveButton from 'components/save_button';
import AdminHeader from 'components/widgets/admin_console/admin_header';
import TextSetting from 'components/widgets/settings/text_setting';

import {getHistory} from 'utils/browser_history';

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
    getAccessControlExpressionAutocomplete: () => Promise<ActionResult>;
}

export interface PolicyDetailsProps {
    policyId?: string;
    actions: PolicyActions;
    autocompleteResult: AccessControlExpressionAutocomplete;
}

interface ChannelChanges {
    removed: Record<string, ChannelWithTeamData>;
    added: Record<string, ChannelWithTeamData>;
    removedCount: number;
}

const PolicyDetails: React.FC<PolicyDetailsProps> = ({policyId, actions}) => {
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
    const [autocompleteResult, setAutocompleteResult] = useState<AccessControlExpressionAutocomplete>({entities: {}});

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
        if (policyId) {
            const result = await actions.fetchPolicy(policyId);

            // Set policy name and expression after fetching the policy
            setPolicyName(result.data?.name || '');
            setExpression(result.data?.rules?.[0]?.expression || '');

            // Search for channels after setting the policy details
            const channelsResult = await actions.searchChannels(policyId, '', {per_page: DEFAULT_PAGE_SIZE});
            setChannelsCount(channelsResult.data?.total_count || 0);

            const autocompleteResult = await actions.getAccessControlExpressionAutocomplete();
            if (autocompleteResult.data) {
                setAutocompleteResult(autocompleteResult.data);
            }
        }
    };

    const handleSubmit = async () => {
        try {
            const updatedPolicy = await actions.createPolicy({
                id: policyId || '',
                name: policyName,
                rules: [{expression, actions: ['*']}] as AccessControlPolicyRule[],
                type: 'parent',
                version: 'v0.1',
            });

            if (updatedPolicy.data.id) {
                if (channelChanges.removedCount > 0) {
                    await actions.unassignChannelsFromAccessControlPolicy(updatedPolicy.data.id, Object.keys(channelChanges.removed));
                }
                if (Object.keys(channelChanges.added).length > 0) {
                    await actions.assignChannelsToAccessControlPolicy(updatedPolicy.data.id, Object.keys(channelChanges.added));
                }
            }

            getHistory().push('/admin_console/user_management/attribute_based_access_control/edit_policy/' + updatedPolicy.data.id);

            setChannelChanges({removed: {}, added: {}, removedCount: 0});
            await loadPage();
            setSaveNeeded(false);
            actions.setNavigationBlocked(false);
        } catch (error) {
            setServerError(true);
        }
    };

    const handleDelete = async () => {
        try {
            if (policyId) {
                if (channelChanges.removedCount > 0) {
                    await actions.unassignChannelsFromAccessControlPolicy(policyId, Object.keys(channelChanges.removed));
                }

                await actions.deletePolicy(policyId).then(
                    (result) => {
                        if (result.data) {
                            getHistory().push('/admin_console/user_management/attribute_based_access_control');
                        }
                    },
                );
            }
        } catch (error) {
            setServerError(true);
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
                                    userAttributes={autocompleteResult.entities.user?.attributes?.map((attr) => ({
                                        attribute: attr.name,
                                        values: attr.values,
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

            <div className='admin-console-save'>
                <SaveButton
                    disabled={!saveNeeded}
                    onClick={handleSubmit}
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
};

export default PolicyDetails;
