// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import Permissions from 'mattermost-redux/constants/permissions';

import {Team} from '@mattermost/types/teams';

import TeamPermissionGate from 'components/permissions_gates/team_permission_gate';
import MemberListTeam from 'components/member_list_team';
import InvitationModal from 'components/invitation_modal';

import {ModalData} from 'types/actions';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    currentTeam: Team;
    onExited: () => void;
    onLoad?: () => void;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

type State = {
    show: boolean;
}

export default class TeamMembersModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            show: true,
        };
    }

    componentDidMount() {
        if (this.props.onLoad) {
            this.props.onLoad();
        }
    }

    handleHide = () => {
        this.setState({show: false});
    }

    handleInvitePeople = () => {
        const {actions} = this.props;

        actions.openModal({
            modalId: ModalIdentifiers.INVITATION,
            dialogType: InvitationModal,
        });

        this.handleHide();
    }

    render() {
        let teamDisplayName = '';
        if (this.props.currentTeam) {
            teamDisplayName = this.props.currentTeam.display_name;
        }

        return (
            <Modal
                dialogClassName='a11y__modal more-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.props.onExited}
                role='dialog'
                aria-labelledby='teamMemberModalLabel'
                id='teamMembersModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='teamMemberModalLabel'
                    >
                        <FormattedMessage
                            id='team_member_modal.members'
                            defaultMessage='{team} Members'
                            values={{
                                team: teamDisplayName,
                            }}
                        />
                    </Modal.Title>
                    <TeamPermissionGate
                        teamId={this.props.currentTeam.id}
                        permissions={[Permissions.ADD_USER_TO_TEAM, Permissions.INVITE_GUEST]}
                    >
                        <button
                            id='invitePeople'
                            type='button'
                            className='btn btn-primary invite-people-btn'
                            onClick={this.handleInvitePeople}
                        >
                            <FormattedMessage
                                id='team_member_modal.invitePeople'
                                defaultMessage='Invite People'
                            />
                        </button>
                    </TeamPermissionGate>
                </Modal.Header>
                <Modal.Body>
                    <MemberListTeam
                        teamId={this.props.currentTeam.id}
                    />
                </Modal.Body>
            </Modal>
        );
    }
}
