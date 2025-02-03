// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {UserProfile} from '@mattermost/types/users';

import * as UserUtils from 'mattermost-redux/utils/user_utils';

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
        leaveTeam: (teamId: string, userId: string) => void;
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
                    <FormattedMessage
                        id='leave_team_modal_guest.description'
                        defaultMessage='<strong>You will be removed from {num_of_public_channels} public {num_of_public_channels,plural,one {channel} other {channels}} and {num_of_private_channels} private {num_of_private_channels,plural,one {channel} other {channels}} on this team.</strong> You won&apos;t be able to rejoin it without an invitation from another team member. Are you sure?'
                        values={{
                            num_of_public_channels: numOfPublicChannels,
                            num_of_private_channels: numOfPrivateChannels,
                            strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                );
            } else if (numOfPublicChannels === 0) {
                modalMessage = (
                    <FormattedMessage
                        id='leave_team_modal_guest_only_private.description'
                        defaultMessage='<strong>You will be removed from {num_of_private_channels} private {num_of_private_channels,plural,one {channel} other {channels}} on this team.</strong> You won&apos;t be able to rejoin it without an invitation from another team member. Are you sure?'
                        values={{
                            num_of_private_channels: numOfPrivateChannels,
                            strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                );
            } else {
                modalMessage = (
                    <FormattedMessage
                        id='leave_team_modal_guest_only_public.description'
                        defaultMessage='<strong>You will be removed from {num_of_public_channels} public {num_of_public_channels,plural,one {channel} other {channels}} on this team.</strong> You won&apos;t be able to rejoin it without an invitation from another team member. Are you sure?'
                        values={{
                            num_of_public_channels: numOfPublicChannels,
                            strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                        }}
                    />
                );
            }
        } else if (numOfPublicChannels !== 0 && numOfPrivateChannels !== 0) {
            modalMessage = (
                <FormattedMessage
                    id='leave_team_modal.description'
                    defaultMessage='<strong>You will be removed from {num_of_public_channels} public {num_of_public_channels,plural,one {channel} other {channels}} and {num_of_private_channels} private {num_of_private_channels,plural,one {channel} other {channels}} on this team.</strong> If the team is private you won&apos;t be able to rejoin it without an invitation from another team member. Are you sure?'
                    values={{
                        num_of_public_channels: numOfPublicChannels,
                        num_of_private_channels: numOfPrivateChannels,
                        strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                    }}
                />
            );
        } else if (numOfPublicChannels === 0) {
            modalMessage = (
                <FormattedMessage
                    id='leave_team_modal_private.description'
                    defaultMessage='<strong>You will be removed from {num_of_private_channels} private {num_of_private_channels,plural,one {channel} other {channels}} on this team.</strong> If the team is private you won&apos;t be able to rejoin it without an invitation from another team member. Are you sure?'
                    values={{
                        num_of_private_channels: numOfPrivateChannels,
                        strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
                    }}
                />
            );
        } else {
            modalMessage = (
                <FormattedMessage
                    id='leave_team_modal_public.description'
                    defaultMessage='<strong>You will be removed from {num_of_public_channels} public {num_of_public_channels,plural,one {channel} other {channels}} on this team.</strong> Are you sure?'
                    values={{
                        num_of_public_channels: numOfPublicChannels,
                        strong: (chunks: React.ReactNode) => <strong>{chunks}</strong>,
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
                role='none'
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
                        className='btn btn-tertiary'
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
