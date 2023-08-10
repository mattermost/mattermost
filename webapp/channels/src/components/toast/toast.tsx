// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';
import CloseIcon from 'components/widgets/icons/close_icon';
import UnreadAboveIcon from 'components/widgets/icons/unread_above_icon';
import UnreadBelowIcon from 'components/widgets/icons/unread_below_icon';

import Constants from 'utils/constants';

import type {ReactNode, MouseEventHandler} from 'react';
import type {OverlayTriggerProps} from 'react-bootstrap';

import './toast.scss';

export type Props = {
    onClick?: MouseEventHandler<HTMLDivElement>;
    onClickMessage?: string;
    onDismiss?: () => void;
    children?: ReactNode;
    show: boolean;
    showActions?: boolean; //used for showing jump actions
    width: number;
    extraClasses?: string;
    overlayPlacement?: OverlayTriggerProps['placement'];
    jumpDirection?: 'up' | 'down';
}

export default class Toast extends React.PureComponent<Props> {
    private mounted!: boolean;

    static defaultProps = {
        overlayPlacement: 'bottom',
        jumpDirection: 'down',
    };

    componentDidMount() {
        this.mounted = true;
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    handleDismiss = () => {
        if (typeof this.props.onDismiss == 'function') {
            this.props.onDismiss();
        }
    };

    render() {
        let toastClass = 'toast';
        const {show, extraClasses, showActions, width, overlayPlacement, jumpDirection} = this.props;

        if (extraClasses) {
            toastClass += ` ${extraClasses}`;
        }

        if (show) {
            toastClass += ' toast__visible';
        }

        let toastActionClass = 'toast__message';
        if (showActions) {
            toastActionClass += ' toast__pointer';
        }

        const jumpSection = () => {
            return (
                <div
                    className='toast__jump'
                >
                    {jumpDirection === 'down' ? <UnreadBelowIcon/> : <UnreadAboveIcon/>}
                    {width > Constants.MOBILE_SCREEN_WIDTH && this.props.onClickMessage}
                </div>
            );
        };

        let closeTooltip = (<div/>);
        if (showActions && show) {
            closeTooltip = (
                <Tooltip id='toast-close__tooltip'>
                    <FormattedMessage
                        id='general_button.close'
                        defaultMessage='Close'
                    />
                    <div className='tooltip__shortcut--txt'>
                        <FormattedMessage
                            id='general_button.esc'
                            defaultMessage='esc'
                        />
                    </div>
                </Tooltip>
            );
        }

        return (
            <div className={toastClass}>
                <div
                    className={toastActionClass}
                    onClick={showActions ? this.props.onClick : undefined}
                >
                    {showActions && jumpSection()}
                    {this.props.children}
                </div>
                <OverlayTrigger
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement={overlayPlacement}
                    overlay={closeTooltip}
                >
                    <div
                        className='toast__dismiss'
                        onClick={this.handleDismiss}
                        data-testid={extraClasses ? `dismissToast-${extraClasses}` : 'dismissToast'}
                    >
                        <CloseIcon
                            className='close-btn'
                            id='dismissToast'
                        />
                    </div>
                </OverlayTrigger>
            </div>
        );
    }
}
