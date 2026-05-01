// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import {setMyChannelAutotranslation} from 'mattermost-redux/actions/channels';

import {sendEphemeralPost} from 'actions/global_actions';
import {closeModal} from 'actions/views/modals';

import ConfirmModal from 'components/confirm_modal';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    channel: Channel;
}

const DisableAutotranslationModal = ({channel}: Props) => {
    const dispatch = useDispatch();
    const [show, setShow] = useState(true);
    const intl = useIntl();

    const handleHide = useCallback(() => {
        setShow(false);
        dispatch(closeModal(ModalIdentifiers.DISABLE_AUTOTRANSLATION_CONFIRM));
    }, [dispatch]);

    const handleConfirm = useCallback(async () => {
        handleHide();
        await dispatch(setMyChannelAutotranslation(channel.id, false));

        // Disabling autotranslations removes all the posts in a channel,
        // so we need to wait for the posts to be removed before sending the ephemeral post.
        requestAnimationFrame(() => {
            dispatch(sendEphemeralPost(
                intl.formatMessage({id: 'channel_header.autotranslation.disable_confirm.ephemeral_message', defaultMessage: 'You disabled Auto-translation for this channel. All messages will show original text. This only affects your view.'}),
                channel.id,
            ));
        });
    }, [channel.id, dispatch, handleHide, intl]);

    const texts = useMemo(() => ({
        title: (
            <FormattedMessage
                id='channel_header.autotranslation.disable_confirm.title'
                defaultMessage='Turn off auto-translation'
            />
        ),
        message: (
            <FormattedMessage
                id='channel_header.autotranslation.disable_confirm.message'
                defaultMessage="Messages in this channel will revert to their original language. This will only affect how you see this channel. Other members won't be affected."
            />
        ),
        confirmButtonText: (
            <FormattedMessage
                id='channel_header.autotranslation.disable_confirm.confirm'
                defaultMessage='Turn off auto-translation'
            />
        ),
        cancelButtonText: (
            <FormattedMessage
                id='channel_header.autotranslation.disable_confirm.cancel'
                defaultMessage='Cancel'
            />
        ),
    }), []);

    return (
        <ConfirmModal
            show={show}
            title={texts.title}
            message={texts.message}
            confirmButtonText={texts.confirmButtonText}
            cancelButtonText={texts.cancelButtonText}
            onConfirm={handleConfirm}
            onCancel={handleHide}
            onExited={handleHide}
            modalClass='disableAutotranslationConfirmModal'
        />
    );
};

export default DisableAutotranslationModal;

