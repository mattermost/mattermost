// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';
import styled from 'styled-components';

import {GenericModal} from '@mattermost/components';
import type {ChannelMembership} from '@mattermost/types/channels';
import type {UserProfile} from '@mattermost/types/users';

import {getMissingProfilesByIds} from 'mattermost-redux/actions/users';
import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentRelativeTeamUrl} from 'mattermost-redux/selectors/entities/teams';
import {getUsers, getUserStatuses} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {openDirectChannelToUserId} from 'actions/channel_actions';
import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import MemberList from 'components/channel_members_rhs/member_list';

import {ModalIdentifiers} from 'utils/constants';
import {mapFeatureIdToTranslation} from 'utils/notify_admin_utils';

import type {GlobalState} from 'types/store';

import './notification_from_members_modal.scss';

type Props = {
    feature: string;
    userIds: string[];
}

export interface ChannelMember {
    user: UserProfile;
    membership?: ChannelMembership;
    status?: string;
    displayName: string;
}

enum ListItemType {
    Member = 'member',
    FirstSeparator = 'first-separator',
    Separator = 'separator',
}

export interface ListItem {
    type: ListItemType;
    data: ChannelMember | JSX.Element;
}

const MembersContainer = styled.div`
    flex: 1 1 auto;
    padding: 0 4px 16px;
    min-height: 500px;
    height: auto;
    width: 100%;
    overflow: auto;
`;

const unknownUser: UserProfile = {id: 'unknown', username: 'unknown'} as UserProfile;

function NotificationFromMembersModal(props: Props) {
    const dispatch = useDispatch();
    const history = useHistory();
    const {formatMessage} = useIntl();

    useEffect(() => {
        dispatch(getMissingProfilesByIds(props.userIds));
    }, [dispatch, props.userIds]);

    const channel = useSelector(getCurrentChannel);
    const teamUrl = useSelector(getCurrentRelativeTeamUrl);
    const userProfiles = useSelector(getUsers);
    const userStatuses = useSelector(getUserStatuses);
    const displaySetting = useSelector(getTeammateNameDisplaySetting);
    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.SUM_OF_MEMBERS_MODAL));

    const members: ListItem[] = props.userIds.map((userId: string) => {
        const user = userProfiles[userId];
        const status = userStatuses[userId];
        const displayName = displayUsername(user, displaySetting);
        return {
            type: ListItemType.Member,
            data: {
                user: user || unknownUser,
                displayName,
                status,
            },
        };
    });

    const openDirectMessage = useCallback(async (user: UserProfile) => {
        // we first prepare the DM channel...
        await dispatch(openDirectChannelToUserId(user.id));

        // ... and then redirect to it
        history.push(teamUrl + '/messages/@' + user.username);
    }, [openDirectChannelToUserId, history, teamUrl]);

    const handleOnClose = () => {
        dispatch(closeModal(ModalIdentifiers.SUM_OF_MEMBERS_MODAL));
    };

    const loadMore = () => {};

    if (!show) {
        return null;
    }

    const modalTitle = formatMessage({id: 'postypes.custom_open_pricing_modal_post_renderer.membersThatRequested', defaultMessage: 'Members that requested '});

    const modalHeaderText = (<h1 id='invitation_modal_title'>
        {`${modalTitle}${mapFeatureIdToTranslation(props.feature, formatMessage)}`}
    </h1>);

    return (
        <GenericModal
            id='notificationFromMembersModal'
            className='NotificationFromMembersModal'
            backdrop={true}
            show={show}
            onExited={handleOnClose}
            aria-modal='true'
            modalHeaderText={modalHeaderText}
        >
            <MembersContainer>
                <MemberList
                    channel={channel}
                    members={members}
                    searchTerms={''}
                    editing={false}
                    openDirectMessage={openDirectMessage}
                    loadMore={loadMore}
                    hasNextPage={false}
                    isNextPageLoading={false}
                />
            </MembersContainer>
        </GenericModal>
    );
}

export default NotificationFromMembersModal;
