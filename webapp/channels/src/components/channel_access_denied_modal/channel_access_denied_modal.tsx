// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

type Props = {
    onExited: () => void;
    channelName?: string;
};

/**
 * Shown when the channel the user is looking at is hidden by an access rule.
 *
 * Deliberately distinct from RemovedFromChannelModal: nothing has been lost, and the
 * channel returns on its own if whatever the rule checks changes back. Telling them
 * they were "removed" would be both wrong and unactionable.
 */
export default function ChannelAccessDeniedModal({onExited, channelName}: Props) {
    const [show, setShow] = useState(true);
    const onHide = useCallback(() => setShow(false), []);

    const name = channelName || (
        <FormattedMessage
            id='channel_access_denied.channelName'
            defaultMessage='this channel'
        />
    );

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={onHide}
            onExited={onExited}
            role='none'
            aria-labelledby='channelAccessDeniedModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='channelAccessDeniedModalLabel'
                >
                    <FormattedMessage
                        id='channel_access_denied.title'
                        defaultMessage='No longer available'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <FormattedMessage
                        id='channel_access_denied.body'
                        defaultMessage='You no longer have access to {channel}. Your membership has not changed, and the channel will reappear if you regain access.'
                        values={{channel: <span className='name'>{name}</span>}}
                    />
                </p>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    type='button'
                    emphasis='primary'
                    onClick={onHide}
                    id='channelAccessDeniedBtn'
                >
                    <FormattedMessage
                        id='channel_access_denied.okay'
                        defaultMessage='Okay'
                    />
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
