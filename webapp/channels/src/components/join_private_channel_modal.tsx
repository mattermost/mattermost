// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import ConfirmModal from 'components/confirm_modal';

type Props = {
    channelName: string;
    onCancel: () => void;
    onExited: () => void;
    onJoin: () => void;
}

function JoinPrivateChannelModal({channelName, onCancel, onExited, onJoin}: Props) {
    const join = React.useRef<boolean>(false);
    const [show, setShow] = React.useState<boolean>(true);

    const handleJoin = () => {
        join.current = true;
        handleHide();
    };

    const handleHide = () => {
        setShow(false);
    };

    const handleExited = () => {
        if (join.current) {
            if (typeof onJoin === 'function') {
                onJoin();
            }
        } else if (typeof onCancel === 'function') {
            onCancel();
        }

        onExited();
    };

    return (
        <ConfirmModal
            show={show}
            title={
                <FormattedMessage
                    id='permalink.show_dialog_warn.title'
                    defaultMessage='Join private channel'
                />
            }
            message={
                <FormattedMessage
                    id='permalink.show_dialog_warn.description'
                    defaultMessage='You are about to join {channel} without explicitly being added by the channel admin. Are you sure you wish to join this private channel?'
                    values={{
                        channel: <b>{channelName}</b>,
                    }}
                />
            }
            confirmButtonText={
                <FormattedMessage
                    id='permalink.show_dialog_warn.join'
                    defaultMessage='Join'
                />
            }
            onConfirm={handleJoin}
            onCancel={handleHide}
            onExited={handleExited}
        />
    );
}

export default React.memo(JoinPrivateChannelModal);
