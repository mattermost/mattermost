// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {trackEvent} from 'actions/telemetry_actions.jsx';
import {closeModal} from 'actions/views/modals';
import GenericModal from 'components/generic_modal';
import {isModalOpen} from 'selectors/views/modals';
import {GlobalState} from 'types/store';
import {ModalIdentifiers} from 'utils/constants';

const MoreDirectBotChannelsModal = () => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const show = useSelector((state: GlobalState) => isModalOpen(state, ModalIdentifiers.MORE_DIRECT_BOT_CHANNELS));

    useEffect(() => {
        trackEvent('plugins', 'more_direct_bot_channels_opened');
    }, []);

    const handleOnClose = () => {
        dispatch(closeModal(ModalIdentifiers.MORE_DIRECT_BOT_CHANNELS));
    };

    const title = formatMessage({id: 'more_direct_bot_channels_modal.title', defaultMessage: 'Apps'});

    return (
        <GenericModal
            id='MoreDirectBotChannels-modal'
            className='MoreDirectBotChannels-modal'
            ariaLabel={title}
            modalHeaderText={title}
            show={show}
            compassDesign={true}
            bodyPadding={false}
            onExited={handleOnClose}
        >
            <div style={{height: 200}}/>
        </GenericModal>
    );
};

export default MoreDirectBotChannelsModal;
