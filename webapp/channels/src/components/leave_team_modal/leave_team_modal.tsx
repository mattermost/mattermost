// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import type {ActionFunc} from 'mattermost-redux/types/actions';
import * as UserUtils from 'mattermost-redux/utils/user_utils';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

type Props = {
    currentUser: UserProfile;
    currentUserId: string;
    currentTeamId: string;
    numOfPublicChannels: number;
    numOfPrivateChannels: number;
    onExited: () => void;
    actions: {
        leaveTeam: (teamId: string, userId: string) => ActionFunc;
        toggleSideBarRightMenu: () => void;
    };
};

type State = {
    show: boolean;
};

export default class LeaveTeamModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    componentDidMount() {
        document.addEventListener('keypress', this.handleKeyPress);
    }

    componentWillUnmount() {
        document.removeEventListener('keypress', this.handleKeyPress);
    }

    handleHide = () => {
        this.setState({
            show: false,
        });
    };

    handleKeyPress = (e: KeyboardEvent) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            this.handleSubmit();
        }
    };

    handleSubmit = () => {
        this.handleHide();

        this.props.actions.leaveTeam(
            this.props.currentTeamId,
            this.props.currentUserId,
        );
        this.props.actions.toggleSideBarRightMenu();
    };

    render() {
        const {
            currentUser,
            numOfPrivateChannels,
            numOfPublicChannels,
        } = this.props;

        const isGuest = UserUtils.isGuest(currentUser.roles);

        let modalMessage;
        if (isGuest) {
            if (numOfPublicChannels !== 0 && numOfPrivateChannels !== 0) {
                modalMessage = (
                    <FormattedMarkdownMessage
                        id='leave_team_modal_guest.desc'
                        defaultMessage="** You will be removed from {num_of_public_channels} public { num_of_public_channels,plural,one {channel} other {channels}} and {num_of_private_channels} private { num_of_private_channels,plural,one {channel} other {channels}} on this team.** You won't be able to rejoin it without an invitation from another team member. Are you sure?"
                        values={{
                            num_of_public_channels: numOfPublicChannels,
                            num_of_private_channels: numOfPrivateChannels,
                        }}
                    />
                );
            } else if (numOfPublicChannels === 0) {
                modalMessage = (
                    <FormattedMarkdownMessage
                        id='leave_team_modal_guest_only_private.desc'
                        defaultMessage="** You will be removed from {num_of_private_channels} private { num_of_private_channels,plural,one {channel} other {channels}} on this team.** You won't be able to rejoin it without an invitation from another team member. Are you sure?"
                        values={{
                            num_of_public_channels: numOfPublicChannels,
                            num_of_private_channels: numOfPrivateChannels,
                        }}
                    />
                );
            } else {
                modalMessage = (
                    <FormattedMarkdownMessage
                        id='leave_team_modal_guest_only_public.desc'
                        defaultMessage="** You will be removed from {num_of_public_channels} public { num_of_public_channels,plural,one {channel} other {channels}} on this team.** You won't be able to rejoin it without an invitation from another team member. Are you sure?"
                        values={{
                            num_of_public_channels: numOfPublicChannels,
                            num_of_private_channels: numOfPrivateChannels,
                        }}
                    />);
            }
        } else if (numOfPublicChannels !== 0 && numOfPrivateChannels !== 0) {
            modalMessage = (
                <FormattedMarkdownMessage
                    id='leave_team_modal.desc'
                    defaultMessage="**You will be removed from {num_of_public_channels} public { num_of_public_channels,plural,one {channel} other {channels} } and {num_of_private_channels} private {num_of_private_channels,one {channel} other {channels}} on this team.** If the team is private you won't be able to rejoin it without an invitation from another team member. Are you sure?"

                    values={{
                        num_of_public_channels: numOfPublicChannels,
                        num_of_private_channels: numOfPrivateChannels,
                    }}
                />);
        } else if (numOfPublicChannels === 0) {
            modalMessage = (
                <FormattedMarkdownMessage
                    id='leave_team_modal_private.desc'
                    defaultMessage="**You will be removed from {num_of_private_channels} private {num_of_private_channels,one {channel} other {channels}} on this team.** If the team is private you won't be able to rejoin it without an invitation from another team member. Are you sure?"
                    values={{
                        num_of_public_channels: numOfPublicChannels,
                        num_of_private_channels: numOfPrivateChannels,
                    }}
                />);
        } else {
            modalMessage = (
                <FormattedMarkdownMessage
                    id='leave_team_modal_public.desc'
                    defaultMessage='**You will be removed from {num_of_public_channels} public { num_of_public_channels,plural,one {channel} other {channels} } on this team.** Are you sure?'
                    values={{
                        num_of_public_channels: numOfPublicChannels,
                        num_of_private_channels: numOfPrivateChannels,
                    }}
                />
            );
        }

        return (
            <Modal
                dialogClassName='a11y__modal'
                className='modal-confirm'
                show={this.state.show}
                onExited={this.props.onExited}
                onHide={this.handleHide}
                id='leaveTeamModal'
                role='dialog'
                aria-labelledby='leaveTeamModalLabel'
            >
                <Modal.Header closeButton={false}>
                    <Modal.Title
                        componentClass='h1'
                        id='leaveTeamModalLabel'
                    >
                        <FormattedMessage
                            id='leave_team_modal.title'
                            defaultMessage='Leave the team?'
                        />
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {modalMessage}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-link'
                        onClick={this.handleHide}
                        id='leaveTeamNo'
                    >
                        <FormattedMessage
                            id='leave_team_modal.no'
                            defaultMessage='No'
                        />
                    </button>
                    <button
                        type='button'
                        className='btn btn-danger'
                        onClick={this.handleSubmit}
                        id='leaveTeamYes'
                    >
                        <FormattedMessage
                            id='leave_team_modal.yes'
                            defaultMessage='Yes'
                        />
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
