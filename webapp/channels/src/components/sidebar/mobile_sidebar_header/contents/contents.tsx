// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import type {UserProfile} from '@mattermost/types/users';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import WithTooltip from 'components/with_tooltip';

import {ModalIdentifiers} from 'utils/constants';

import type {ModalData} from 'types/actions';

const HeaderLine = styled.div`
    display: flex;
    padding: 2px 16px 0 0;
    flex-grow: 1;
    user-select: none;
    color: var(--sidebar-header-text-color);
`;

const VerticalStack = styled.div`
    display: flex;
    flex-direction: column;
    flex-grow: 1;
`;

type Props = {
    teamDescription?: string;
    teamId?: string;
    currentUser: UserProfile;
    teamDisplayName?: string;
    actions: Actions;
};

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
};

export default class Contents extends React.PureComponent<Props> {
    handleCustomStatusEmojiClick = (event: React.MouseEvent) => {
        event.stopPropagation();
        const customStatusInputModalData = {
            modalId: ModalIdentifiers.CUSTOM_STATUS,
            dialogType: CustomStatusModal,
        };
        this.props.actions.openModal(customStatusInputModalData);
    };

    render() {
        if (!this.props.currentUser || !this.props.teamId) {
            return null;
        }

        let teamNameWithToolTip = (
            <h1
                id='headerTeamName'
                className='team__name'
                data-teamid={this.props.teamId}
            >
                {this.props.teamDisplayName}
            </h1>
        );

        if (this.props.teamDescription) {
            teamNameWithToolTip = (
                <WithTooltip
                    title={this.props.teamDescription}
                >
                    {teamNameWithToolTip}
                </WithTooltip>
            );
        }

        return (
            <div
                className='SidebarHeaderDropdownButton'
                id='sidebarHeaderDropdownButton'
            >
                <HeaderLine
                    id='headerInfo'
                    className='header__info'
                >
                    <VerticalStack>
                        {teamNameWithToolTip}
                        <div
                            id='headerInfoContent'
                            className='header__info__content'
                        >
                            <div
                                id='headerUsername'
                                className='user__name'
                            >
                                {'@' + this.props.currentUser.username}
                            </div>
                            <CustomStatusEmoji
                                showTooltip={true}
                                emojiStyle={{
                                    verticalAlign: 'top',
                                    marginLeft: 2,
                                }}
                                onClick={this.handleCustomStatusEmojiClick as unknown as () => void}
                            />
                        </div>
                    </VerticalStack>
                </HeaderLine>
            </div>
        );
    }
}
