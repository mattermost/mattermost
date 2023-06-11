// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentProps, useCallback, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import {useDispatch} from 'react-redux';

import {getProfilesInTeam, searchProfiles} from 'mattermost-redux/actions/users';

import styled from 'styled-components';
import {AccountMinusOutlineIcon, AccountPlusOutlineIcon, PlayIcon} from '@mattermost/compass-icons/components';

import {FullPlaybook, Loaded, useUpdatePlaybook} from 'src/graphql/hooks';

import {Section, SectionTitle} from 'src/components/backstage/playbook_edit/styles';
import {InviteUsers} from 'src/components/backstage/playbook_edit/automation/invite_users';
import {AutoAssignOwner} from 'src/components/backstage/playbook_edit/automation/auto_assign_owner';
import {WebhookSetting} from 'src/components/backstage/playbook_edit/automation/webhook_setting';
import {CreateAChannel} from 'src/components/backstage/playbook_edit/automation/channel_access';
import {PROFILE_CHUNK_SIZE} from 'src/constants';

import {Toggle} from 'src/components/backstage/playbook_edit/automation/toggle';
import {AutomationTitle} from 'src/components/backstage/playbook_edit/automation/styles';

import {useProxyState} from 'src/hooks';
import {getDistinctAssignees} from 'src/utils';

interface Props {
    playbook: Loaded<FullPlaybook>;
}

const LegacyActionsEdit = ({playbook}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const updatePlaybook = useUpdatePlaybook(playbook.id);
    const archived = playbook.delete_at !== 0;

    const [
        playbookForCreateChannel,
        setPlaybookForCreateChannel,
    ] = useProxyState<ComponentProps<typeof CreateAChannel>['playbook']>(playbook, useCallback((update) => {
        updatePlaybook({
            createPublicPlaybookRun: update.create_public_playbook_run,
            channelNameTemplate: update.channel_name_template,
            channelMode: update.channel_mode,
            channelId: update.channel_id,
        });
    }, [updatePlaybook]));

    const preAssignees = useMemo(() => {
        return getDistinctAssignees(playbook.checklists);
    }, [playbook.checklists]);

    const searchUsers = (term: string) => {
        return dispatch(searchProfiles(term, {team_id: playbook.team_id}));
    };

    const getUsers = () => {
        return dispatch(getProfilesInTeam(playbook.team_id, 0, PROFILE_CHUNK_SIZE, '', {active: true}));
    };

    const handleAddUserInvited = (userId: string) => {
        if (!playbook.invited_user_ids.includes(userId)) {
            updatePlaybook({
                invitedUserIDs: [...playbook.invited_user_ids, userId],
            });
        }
    };

    const handleRemoveUserInvited = (userId: string) => {
        const idx = playbook.invited_user_ids.indexOf(userId);
        updatePlaybook({
            invitedUserIDs: [...playbook.invited_user_ids.slice(0, idx), ...playbook.invited_user_ids.slice(idx + 1)],
        });
    };

    const handleRemovePreAssignedUserInvited = (userId: string) => {
        // Iterate all checklists and their tasks and unassign the given user from all tasks
        const checklists = playbook.checklists.map((cl) => ({
            ...cl,
            items: cl.items.map((ci) => ({
                title: ci.title,
                description: ci.description,
                state: ci.state,
                stateModified: ci.state_modified || 0,
                assigneeID: ci.assignee_id === userId ? '' : ci.assignee_id || '',
                assigneeModified: ci.assignee_modified || 0,
                command: ci.command,
                commandLastRun: ci.command_last_run,
                dueDate: ci.due_date,
                taskActions: ci.task_actions,
            })),
        }));
        const idx = playbook.invited_user_ids.indexOf(userId);
        updatePlaybook({
            checklists,
            invitedUserIDs: [...playbook.invited_user_ids.slice(0, idx), ...playbook.invited_user_ids.slice(idx + 1)],
        });
    };

    const handleRemovePreAssignedUsers = () => {
        // Iterate all checklists and their tasks and unassign all assignees
        const checklists = playbook.checklists.map((cl) => ({
            ...cl,
            items: cl.items.map((ci) => ({
                title: ci.title,
                description: ci.description,
                state: ci.state,
                stateModified: ci.state_modified || 0,
                assigneeID: '',
                assigneeModified: ci.assignee_modified || 0,
                command: ci.command,
                commandLastRun: ci.command_last_run,
                dueDate: ci.due_date,
                taskActions: ci.task_actions,
            })),
        }));
        updatePlaybook({
            checklists,
            inviteUsersEnabled: false,
        });
    };

    const handleAssignDefaultOwner = (userId: string | undefined) => {
        if ((userId || userId === '') && playbook.default_owner_id !== userId) {
            updatePlaybook({
                defaultOwnerID: userId,
            });
        }
    };

    const handleWebhookOnCreationChange = (urls: string) => {
        updatePlaybook({
            webhookOnCreationURLs: urls.split('\n'),
        });
    };

    const handleToggleInviteUsers = () => {
        updatePlaybook({
            inviteUsersEnabled: !playbook.invite_users_enabled,
        });
    };

    const handleToggleDefaultOwner = () => {
        updatePlaybook({
            defaultOwnerEnabled: !playbook.default_owner_enabled,
        });
    };

    const handleToggleWebhookOnCreation = () => {
        updatePlaybook({
            webhookOnCreationEnabled: !playbook.webhook_on_creation_enabled,
        });
    };

    return (
        <>
            <StyledSection>
                <StyledSectionTitle>
                    <PlayIcon size={24}/>
                    <FormattedMessage defaultMessage='When a run starts'/>
                </StyledSectionTitle>
                <Setting id={'channel-action'}>
                    <CreateAChannel
                        playbook={playbookForCreateChannel}
                        setPlaybook={setPlaybookForCreateChannel}
                    />
                </Setting>
                <Setting id={'invite-users'}>
                    <InviteUsers
                        disabled={archived}
                        enabled={playbook.invite_users_enabled}
                        onToggle={handleToggleInviteUsers}
                        searchProfiles={searchUsers}
                        getProfiles={getUsers}
                        userIds={playbook.invited_user_ids}
                        preAssignedUserIds={preAssignees}
                        onAddUser={handleAddUserInvited}
                        onRemoveUser={handleRemoveUserInvited}
                        onRemovePreAssignedUser={handleRemovePreAssignedUserInvited}
                        onRemovePreAssignedUsers={handleRemovePreAssignedUsers}
                    />
                </Setting>
                <Setting id={'assign-owner'}>
                    <AutoAssignOwner
                        disabled={archived}
                        enabled={playbook.default_owner_enabled}
                        onToggle={handleToggleDefaultOwner}
                        searchProfiles={searchUsers}
                        getProfiles={getUsers}
                        ownerID={playbook.default_owner_id}
                        onAssignOwner={handleAssignDefaultOwner}
                    />
                </Setting>
                <Setting id={'playbook-run-creation__outgoing-webhook'}>
                    <WebhookSetting
                        disabled={archived}
                        enabled={playbook.webhook_on_creation_enabled}
                        onToggle={handleToggleWebhookOnCreation}
                        input={playbook.webhook_on_creation_urls.join('\n')}
                        onBlur={handleWebhookOnCreationChange}
                        pattern={'https?://.*'}
                        delimiter={'\n'}
                        maxLength={1000}
                        rows={3}
                        placeholderText={formatMessage({defaultMessage: 'Enter webhook'})}
                        textOnToggle={formatMessage({defaultMessage: 'Send outgoing webhook (One per line)'})}
                        errorText={formatMessage({defaultMessage: 'Invalid webhook URLs'})}
                        maxRows={64}
                        maxErrorText={formatMessage({defaultMessage: 'Invalid entry: the maximum number of webhooks allowed is 64'})}
                    />
                </Setting>
            </StyledSection>

            <StyledSection>
                <StyledSectionTitle>
                    <AccountPlusOutlineIcon size={22}/>
                    <FormattedMessage defaultMessage='When a participant joins the run'/>
                </StyledSectionTitle>
                <Setting id={'participant-joins-run'}>
                    <AutomationTitle>
                        <Toggle
                            disabled={archived}
                            isChecked={playbook.create_channel_member_on_new_participant}
                            onChange={() => {
                                updatePlaybook({
                                    createChannelMemberOnNewParticipant: !playbook.create_channel_member_on_new_participant,
                                });
                            }}
                        >
                            <FormattedMessage defaultMessage='Add them to the run channel'/>
                        </Toggle>
                    </AutomationTitle>
                </Setting>
            </StyledSection>

            <StyledSection>
                <StyledSectionTitle>
                    <AccountMinusOutlineIcon size={22}/>
                    <FormattedMessage defaultMessage='When a participant leaves the run'/>
                </StyledSectionTitle>
                <Setting id={'participant-leaves-run'}>
                    <AutomationTitle>
                        <Toggle
                            disabled={archived}
                            isChecked={playbook.remove_channel_member_on_removed_participant}
                            onChange={() => {
                                updatePlaybook({
                                    removeChannelMemberOnRemovedParticipant: !playbook.remove_channel_member_on_removed_participant,
                                });
                            }}
                        >
                            <FormattedMessage defaultMessage='Remove them from the run channel'/>
                        </Toggle>
                    </AutomationTitle>
                </Setting>
            </StyledSection>
        </>
    );
};

export default LegacyActionsEdit;

const StyledSection = styled(Section)`
    border: 1px solid rgba(var(--center-channel-color-rgb), 0.08);
    padding: 2rem;
    padding-bottom: 0;
    margin: 0;
    margin-bottom: 20px;
    border-radius: 8px;
`;

const StyledSectionTitle = styled(SectionTitle)`
    font-weight: 600;
    margin: 0 0 24px;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
    svg {
        color: rgba(var(--center-channel-color-rgb), 0.48);
    }
`;

const Setting = styled.div`
    margin-bottom: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
`;

