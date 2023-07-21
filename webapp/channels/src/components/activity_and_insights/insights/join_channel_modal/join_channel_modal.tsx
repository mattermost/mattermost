// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {TopThread} from '@mattermost/types/insights';
import React, {memo, useState, useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {selectPost} from 'actions/views/rhs';
import {joinChannel} from 'mattermost-redux/actions/channels';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/common';
import {ActionResult} from 'mattermost-redux/types/actions';

import SaveButton from 'components/save_button';

import {localizeMessage} from 'utils/utils';

import './../../activity_and_insights.scss';

type Props = {
    onExited: () => void;
    thread: TopThread;
    currentTeamId: string;
}

const JoinChannelModal = (props: Props) => {
    const dispatch = useDispatch();

    const [show, setShow] = useState(true);
    const [saving, setSaving] = useState(false);

    const currentUserId = useSelector(getCurrentUserId);

    const doHide = useCallback(() => {
        setShow(false);
    }, []);

    const openRHS = useCallback(async () => {
        setSaving(true);
        const {error} = await dispatch(joinChannel(currentUserId, props.currentTeamId, props.thread.channel_id, props.thread.channel_name)) as ActionResult;
        if (!error) {
            await dispatch(selectPost(props.thread.post));
        }
        doHide();
    }, []);

    return (
        <Modal
            dialogClassName='a11y__modal insights-modal join-channel-modal'
            show={show}
            onHide={doHide}
            onExited={props.onExited}
            aria-labelledby='insightsModalLabel'
            id='insightsModal'
        >
            <Modal.Header closeButton={true}>
                <div className='title-section'>
                    <Modal.Title
                        componentClass='h1'
                        id='insightsModalTitle'
                    >
                        <FormattedMessage
                            id='joinChannel.title'
                            defaultMessage='Join channel?'
                        />
                    </Modal.Title>
                </div>
            </Modal.Header>
            <Modal.Body
                className='overflow--visible'
            >
                <FormattedMessage
                    id='joinChannel.desciption'
                    defaultMessage={'You\'ll need to join the {channel} channel to see this thread. Do you want to join {channel} now?'}
                    values={{
                        channel: <strong>{props.thread.channel_display_name}</strong>,
                    }}
                />
                <div className='button-footer'>
                    <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.preventDefault();
                            props.onExited();
                        }}
                        className='btn join-channel-cancel'
                    >
                        {localizeMessage('joinChannel.cancelButton', 'Cancel')}
                    </button>
                    <SaveButton
                        id='saveItems'
                        saving={saving}
                        onClick={(e) => {
                            e.preventDefault();
                            openRHS();
                        }}
                        defaultMessage={localizeMessage('joinChannel.JoinButton', 'Join')}
                        savingMessage={localizeMessage('joinChannel.joiningButton', 'Joining...')}
                    />
                </div>
            </Modal.Body>
        </Modal>
    );
};

export default memo(JoinChannelModal);
