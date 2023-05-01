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
            <FooterButton
                cancel={true}
                onClick={cancelButtonAction}
            >
                {formatMessage({id: 'work_templates.channel_only.cancel', defaultMessage: 'Cancel'})}
            </FooterButton>
            <FooterButton
                confirm={true}
                onClick={createChannelOnly}
                disabled={props.isConfirmDisabled}
                className={classnames({disabled: props.isConfirmDisabled})}
            >
                {formatMessage({id: 'work_templates.channel_only.confirm', defaultMessage: 'Create channel'})}
            </FooterButton>
        </Footer>
    );
}

const genericModalSidePadding = '32px';

const Footer = styled.div`
    position: relative;
    &:after {
        content: '';
        position: absolute;
        width: calc(100% + ${genericModalSidePadding} * 2);
        left: -${genericModalSidePadding};
        top: 0;
        height: 1px;
        background-color: rgba(var(--center-channel-text-rgb), 0.08);
    }
    padding: 24px 0;
    text-align: right;
`;

interface FooterButtonProps {
    cancel?: boolean;
    confirm?: boolean;
}
const primaryButton = `
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: var(--button-bg);
    border-radius: 4px;
    color: var(--button-color);
    font-weight: 600;
    transition: all 0.15s ease-out;

    &:hover {
        background: linear-gradient(0deg, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.08)), var(--button-bg);
    }

    &:active {
        background: linear-gradient(0deg, rgba(0, 0, 0, 0.16), rgba(0, 0, 0, 0.16)), var(--button-bg);
    }

    &:focus {
        box-sizing: border-box;
        border: 2px solid var(--sidebar-text-active-border);
        outline: none;
    }

    &:disabled:not(.always-show-enabled) {
        background: rgba(var(--center-channel-color-rgb), 0.08);
        color: rgba(var(--center-channel-color-rgb), 0.32);
        cursor: not-allowed;
    }

    i {
        display: flex;
        font-size: 18px;
    }
`;
const buttonMedium = `
    height: 40px;
    padding: 0 20px;
    font-size: 14px;
    line-height: 14px;
`;
const FooterButton = styled.button<FooterButtonProps>`
    padding: 13px 20px;
    border: none;
    border-radius: 4px;
    box-shadow: none;
    ${buttonMedium};

    ${(props) => (props.cancel ? `
        margin-right: 8px;
        background: var(--center-channel-bg);
        background: rgba(var(--button-bg-rgb), 0.08);
        color: var(--button-bg);

        &:hover {
            background: rgba(var(--button-bg-rgb), 0.12);
        }

        &:active {
            background: rgba(var(--button-bg-rgb), 0.16);
        }

        &:focus {
            box-sizing: border-box;
            padding: 11px 18px;
            border: 2px solid var(--sidebar-text-active-border);
        }
    ` : '')}

    ${(props) => (props.confirm ? `
        ${primaryButton}
        &:focus {
            padding: 11px 18px;
        }
    ` : '')}
`;

