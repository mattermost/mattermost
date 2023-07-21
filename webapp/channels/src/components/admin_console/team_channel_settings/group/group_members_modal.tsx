// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Group} from '@mattermost/types/groups';
import React from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import MemberListGroup from 'components/admin_console/member_list_group';

type Props = {
    group: Group;
    onExited: () => void;
    onLoad?: () => void;
}

type State = {
    show: boolean;
}

export default class GroupMembersModal extends React.PureComponent<Props, State> {
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
    };

    handleExit = () => {
        this.props.onExited();
    };

    render() {
        const {group} = this.props;

        const button = (
            <FormattedMessage
                id='admin.team_channel_settings.groupMembers.close'
                defaultMessage='Close'
            />
        );

        return (
            <Modal
                dialogClassName='a11y__modal settings-modal'
                show={this.state.show}
                onHide={this.handleHide}
                onExited={this.handleExit}
                role='dialog'
                aria-labelledby='groupMemberModalLabel'
                id='groupMembersModal'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='groupMemberModalLabel'
                    >
                        {group.display_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <MemberListGroup
                        groupID={group.id}
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        autoFocus={true}
                        type='button'
                        className='btn btn-primary'
                        onClick={this.handleHide}
                        id='closeModalButton'
                    >
                        {button}
                    </button>
                </Modal.Footer>
            </Modal>
        );
    }
}
