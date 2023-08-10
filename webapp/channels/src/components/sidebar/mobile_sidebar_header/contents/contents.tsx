// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusModal from 'components/custom_status/custom_status_modal';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants, {ModalIdentifiers} from 'utils/constants';

import type {UserProfile} from '@mattermost/types/users';
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
    teamDescription: string;
    teamId: string;
    currentUser: UserProfile;
    teamDisplayName: string;
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
        if (!this.props.currentUser) {
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
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='bottom'
                    overlay={<Tooltip id='team-name__tooltip'>{this.props.teamDescription}</Tooltip>}
                >
                    {teamNameWithToolTip}
                </OverlayTrigger>
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
                                tooltipDirection='bottom'
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
