// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';

type Props = {
    onExited: () => void;
    channelName?: string;

    // Shown when dm_gm_read_access hides every direct and group message, rather than one channel.
    isConversation?: boolean;
};

export default function ChannelReadAccessDeniedModal({onExited, channelName, isConversation}: Props) {
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
                    {isConversation ? (
                        <FormattedMessage
                            id='channel_access_denied.dm_gm.body'
                            defaultMessage='You no longer have access to direct and group messages. They will reappear if access is restored.'
                        />
                    ) : (
                        <FormattedMessage
                            id='channel_access_denied.body'
                            defaultMessage='You no longer have access to {channel}. Your membership has not changed, and the channel will reappear if you regain access.'
                            values={{channel: <span className='name'>{name}</span>}}
                        />
                    )}
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
