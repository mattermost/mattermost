// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {useIntl} from 'react-intl';
import styled from 'styled-components';
import classnames from 'classnames';

import {ModalIdentifiers, TELEMETRY_CATEGORIES} from 'utils/constants';
import {closeModal} from 'actions/views/modals';
import {trackEvent} from 'actions/telemetry_actions';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {overlayScrollbarAllowance} from '../constants';
import {ThemeProvider, Button} from '@mattermost/components'

interface Props {
    createChannel: () => void;
    isConfirmDisabled: boolean;
}
import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

export default function ChannelOnlyFooter(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch<DispatchFunc>();
    const theme = useSelector(getTheme);
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
            <ThemeProvider theme={theme}>
                <Button
                    variant='tertiary'
                    onClick={cancelButtonAction}
                >
                    {formatMessage({id: 'work_templates.channel_only.cancel', defaultMessage: 'Cancel'})}
                </Button>
                <Button
                    onClick={createChannelOnly}
                    disabled={props.isConfirmDisabled}
                    className={classnames({disabled: props.isConfirmDisabled})}
                >
                    {formatMessage({id: 'work_templates.channel_only.confirm', defaultMessage: 'Create channel'})}
                </Button>
            </ThemeProvider>
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

