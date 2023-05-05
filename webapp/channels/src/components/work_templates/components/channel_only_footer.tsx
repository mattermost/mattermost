// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import classnames from 'classnames';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {closeModal} from 'actions/views/modals';
import {trackEvent} from 'actions/telemetry_actions';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {overlayScrollbarAllowance} from '../constants';

import './channel_only_footer.scss';

interface Props {
    createChannel: () => void;
    isConfirmDisabled: boolean;
}

export default function ChannelOnlyFooter(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const trackAction = (action: string, actionFn: () => void) => () => {
        trackEvent(TELEMETRY_CATEGORIES.WORK_TEMPLATES, action, props);
        actionFn();
    };
    const createChannelOnly = trackAction('btn_go_to_customize', props.createChannel);
    const cancelButtonAction = trackAction('close_channel_only', () => {
        dispatch(closeModal(ModalIdentifiers.WORK_TEMPLATE));
    });

    return (
        <Footer>
            <button
                onClick={cancelButtonAction}
                className='ChannelOnlyFooter__cancel'
            >
                {formatMessage({id: 'work_templates.channel_only.cancel', defaultMessage: 'Cancel'})}
            </button>
            <button
                onClick={createChannelOnly}
                disabled={props.isConfirmDisabled}
                className={classnames('ChannelOnlyFooter__confirm', {disabled: props.isConfirmDisabled})}
            >
                {formatMessage({id: 'work_templates.channel_only.confirm', defaultMessage: 'Create channel'})}
            </button>
        </Footer>
    );
}

const genericModalSidePadding = '32px';

const Footer = styled.div`
    position: relative;
    &:after {
        content: '';
        position: absolute;
        width: calc(100% + ${genericModalSidePadding} * 2 - ${overlayScrollbarAllowance});
        left: -${genericModalSidePadding};
        top: 0;
        height: 1px;
        background-color: rgba(var(--center-channel-text-rgb), 0.08);
    }
    padding: 24px 0;
    text-align: right;
`;
