// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useEffect, useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {Group} from '@mattermost/types/groups';

import MemberListGroup from 'components/admin_console/member_list_group';

type Props = {
    group: Group;
    onExited: () => void;
    onLoad?: () => void;
}

const GroupMembersModal: React.FC<Props> = ({
    group, onExited, onLoad,
}) => {
    const [show, setShow] = useState(true);

    useEffect(() => {
        onLoad?.();
    }, []);

    const handleHide = useCallback(() => {
        setShow(false);
    }, []);

    const handleExit = useCallback(() => {
        onExited();
    }, [onExited]);

    const button = (
        <FormattedMessage
            id='admin.team_channel_settings.groupMembers.close'
            defaultMessage='Close'
        />
    );

    return (
        <Modal
            dialogClassName='a11y__modal settings-modal'
            show={show}
            onHide={handleHide}
            onExited={handleExit}
            role='none'
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
                    onClick={handleHide}
                    id='closeModalButton'
                >
                    {button}
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default React.memo(GroupMembersModal);
