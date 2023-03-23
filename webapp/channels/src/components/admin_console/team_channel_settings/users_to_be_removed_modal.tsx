// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {Modal} from 'react-bootstrap';

import {UserProfile} from '@mattermost/types/users';

import FormattedMarkdownMessage from 'components/formatted_markdown_message';

import GroupsUsers from './group/group_users';

type Props = {

    /*
     * Number of users to be removed
     */
    total: number;

    /*
     * Scope that the users are to be removed from
     * can be either 'team' or 'channel'
     */
    scope: 'team' | 'channel';

    /*
     * Id of the scope that the users are to be removed from
     * can be either a Team ID or a Channel ID
     */
    scopeId: string;

    /*
     * users to be removed
     */
    users: UserProfile[];

    onExited?: () => void;
};

const UsersToBeRemovedModal = ({total, scope, scopeId, users, onExited}: Props) => {
    const [show, setShow] = useState(true);

    const handleHide = useCallback(() => setShow(false), []);

    const title = (
        <FormattedMarkdownMessage
            id='admin.team_channel_settings.usersToBeRemovedModal.title'
            defaultMessage='**{total, number} {total, plural, one {User} other {Users}}** To Be Removed'
            values={{total}}
        />
    );

    let message = (
        <FormattedMessage
            id='admin.team_channel_settings.usersToBeRemovedModal.message'
            defaultMessage='The members listed below are not in any of the groups currently linked to this team. Because this team is set to be managed by group sync they will all be removed once saved.'
        />
    );

    if (scope === 'channel') {
        message = (
            <FormattedMessage
                id='admin.team_channel_settings.usersToBeRemovedModal.channel_message'
                defaultMessage='The members listed below are not in any of the groups currently linked to this channel. Because this channel is set to be managed by group sync they will all be removed once saved.'
            />
        );
    }

    const button = (
        <FormattedMessage
            id='admin.team_channel_settings.usersToBeRemovedModal.close'
            defaultMessage='Close'
        />
    );

    return (
        <Modal
            dialogClassName='a11y__modal settings-modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            id='confirmModal'
            role='dialog'
            aria-labelledby='confirmModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='confirmModalLabel'
                >
                    {title}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='group-users-to-remove-modal-description'>{message}</div>
                <GroupsUsers
                    members={users}
                    total={total}
                    scope={scope}
                    scopeId={scopeId}
                />
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    autoFocus={true}
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

export default UsersToBeRemovedModal;
