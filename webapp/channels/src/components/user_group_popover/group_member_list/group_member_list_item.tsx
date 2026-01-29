// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import type {ListChildComponentProps} from 'react-window';
import styled, {css} from 'styled-components';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import type {ActionResult} from 'mattermost-redux/types/actions';

import ProfilePopover from 'components/profile_popover';
import StatusIcon from 'components/status_icon';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';
import Avatar from 'components/widgets/users/avatar';
import WithTooltip from 'components/with_tooltip';

import {UserStatuses} from 'utils/constants';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

// These constants must be changed if user list style is modified
export const ITEM_HEIGHT = 40;
export const MARGIN = 8;

export type GroupMember = {
    user: UserProfile;
    displayName: string;
}

export type Props = {

    /**
     * The group corresponding to the parent popover
     */
    group: Group;

    /**
     * The members corresponding to the group
     */
    members: GroupMember[];

    /**
     * Function to call if parent popover should be hidden
     */
    hide: () => void;

    /**
     * @internal
     */
    teamUrl: string;

    actions: {
        openDirectChannelToUserId: (userId: string) => Promise<ActionResult>;
        closeRightHandSide: () => void;
    };
}

export const GroupMemberListItem = (props: ListChildComponentProps<Props>) => {
    const {
        index,
        style,
        data: {
            group,
            members,
            hide,
            teamUrl,
            actions,
        },
    } = props;

    const history = useHistory();

    const {formatMessage} = useIntl();

    const [currentDMLoading, setCurrentDMLoading] = useState<string | undefined>(undefined);

    const showDirectChannel = (user: UserProfile) => {
        if (currentDMLoading !== undefined) {
            return;
        }
        setCurrentDMLoading(user.id);
        actions.openDirectChannelToUserId(user.id).then((result: ActionResult) => {
            if (!result.error) {
                actions.closeRightHandSide();
                setCurrentDMLoading(undefined);
                hide?.();
                history.push(`${teamUrl}/messages/@${user.username}`);
            }
        });
    };

    const status = useSelector((state: GlobalState) => getStatusForUserId(state, members[index]?.user?.id) || UserStatuses.OFFLINE);

    // Remove explicit height provided by VariableSizeList
    style.height = undefined;

    if (members[index]) {
        const user = members[index].user;
        const name = members[index].displayName;
        return (
            <UserListItem
                className='group-member-list_item'
                first={index === 0}
                last={index === group.member_count - 1}
                style={style}
                key={user.id}
                role='listitem'
            >
                <ProfilePopover
                    userId={user.id}
                    src={Utils.imageURLForUser(user?.id ?? '')}
                    hideStatus={user.is_bot}
                >
                    <UserButton>
                        <span className='status-wrapper'>
                            <Avatar
                                username={user.username}
                                size={'sm'}
                                url={Utils.imageURLForUser(user?.id ?? '')}
                                className={'avatar-post-preview'}
                                tabIndex={-1}
                            />
                            <StatusIcon
                                status={status}
                            />
                        </span>
                        <Username className='overflow--ellipsis text-nowrap'>{name}</Username>
                        <Gap className='group-member-list_gap'/>
                    </UserButton>
                </ProfilePopover>
                <DMContainer className='group-member-list_dm-button'>
                    <WithTooltip
                        title={formatMessage({id: 'group_member_list.sendMessageTooltip', defaultMessage: 'Send message'})}
                    >
                        <DMButton
                            className='btn btn-icon btn-xs'
                            aria-label={formatMessage(
                                {id: 'group_member_list.sendMessageButton', defaultMessage: 'Send message to {user}'},
                                {user: name})}
                            onClick={() => showDirectChannel(user)}
                        >
                            <i
                                className='icon icon-send'
                            />
                        </DMButton>
                    </WithTooltip>
                </DMContainer>
            </UserListItem>
        );
    }

    return (
        <LoadingItem
            style={style}
            first={index === 0}
            last={index === members.length}
        >
            <LoadingSpinner/>
        </LoadingItem>
    );
};

const UserListItem = styled.div<{first?: boolean; last?: boolean}>`
    ${(props) => props.first && css `
        margin-top: ${MARGIN}px;
    `}

    ${(props) => props.last && css `
        margin-bottom: ${MARGIN}px;
    `}

    &:hover {
        background: rgba(var(--center-channel-color-rgb), 0.08);
    }

    .group-member-list_gap {
        display: none;
    }

    .group-member-list_dm-button {
        opacity: 0;
    }

    &:hover .group-member-list_gap,
    &:focus-within .group-member-list_gap {
        display: initial;
    }

    &:hover .group-member-list_dm-button,
    &:focus-within .group-member-list_dm-button {
        opacity: 1;
    }
`;

const UserButton = styled.button`
    display: flex;
    width: 100%;
    padding: 5px 20px;
    border: none;
    background: unset;
    text-align: unset;
    align-items: center;
`;

// A gap to make space for the DM button to be positioned on
const Gap = styled.span`
    width: 24px;
    flex: 0 0 auto;
    margin-left: 4px;
`;

const Username = styled.span`
    padding-left: 12px;
    flex: 1 1 auto;
`;

const DMContainer = styled.div`
    height: 100%;
    position: absolute;
    right: 20px;
    top: 0;
    display: flex;
    align-items: center;
`;

const DMButton = styled.button`
    width: 24px;
    height: 24px;

    svg {
        width: 16px;
    }
`;

const LoadingItem = styled.div<{first?: boolean; last?: boolean}>`
    ${(props) => props.first && css `
        padding-top: ${MARGIN}px;
    `}

    ${(props) => props.last && css `
        padding-bottom: ${MARGIN}px;
    `}

    display: flex;
    justify-content: center;
    align-items: center;
    height: ${ITEM_HEIGHT}px;
    box-sizing: content-box;
`;

export default GroupMemberListItem;
