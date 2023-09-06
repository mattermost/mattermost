// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback, useState} from 'react';
import {useIntl} from 'react-intl';

import {
    AlertOutlineIcon,
    CheckIcon,
    CloseIcon,
    InformationOutlineIcon,
} from '@mattermost/compass-icons/components';

import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

import Constants from 'utils/constants';

import './alert_banner.scss';

export type ModeType = 'danger' | 'warning' | 'info' | 'success';

export type AlertBannerProps = {
    id?: string;
    mode: ModeType;
    title?: React.ReactNode;
    message?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
    hideIcon?: boolean;
    actionButtonLeft?: React.ReactNode;
    actionButtonRight?: React.ReactNode;
    footerMessage?: React.ReactNode;
    closeBtnTooltip?: React.ReactNode;
    onDismiss?: () => void;
    variant?: 'sys' | 'app';
}

const AlertBanner = ({
    id,
    mode,
    title,
    message,
    className,
    variant = 'sys',
    onDismiss,
    actionButtonLeft,
    actionButtonRight,
    closeBtnTooltip,
    footerMessage,
    hideIcon,
    children,
}: AlertBannerProps) => {
    const {formatMessage} = useIntl();
    const closeText = formatMessage({id: 'alert_banner.tooltipCloseBtn', defaultMessage: 'Close'});
    const [tooltipId] = useState(`alert_banner_close_btn_tooltip_${Math.random()}`);

    const bannerIcon = useCallback(() => {
        if (mode === 'danger' || mode === 'warning') {
            return (
                <AlertOutlineIcon
                    size={24}
                />);
        } else if (mode === 'success') {
            return (
                <CheckIcon
                    size={24}
                />);
        }
        return (
            <InformationOutlineIcon
                size={24}
            />);
    }, [mode]);

    return (
        <div
            data-testid={id}
            className={classNames(
                'AlertBanner',
                mode,
                className,
                `AlertBanner--${variant}`,
            )}
        >
            {!hideIcon && (
                <div className='AlertBanner__icon'>
                    {bannerIcon()}
                </div>
            )}
            <div className='AlertBanner__body'>
                {title && <div className='AlertBanner__title'>{title}</div>}
                {message && (
                    <div
                        className={classNames({
                            AlertBanner__message: Boolean(title),
                        })}
                    >
                        {message}
                    </div>
                )}
                {children}
                {(actionButtonLeft || actionButtonRight) && (
                    <div className='AlertBanner__actionButtons'>
                        {actionButtonLeft}
                        {actionButtonRight}
                    </div>
                )}
                {
                    footerMessage && (
                        <div className='AlertBanner__footerMessage'>
                            {footerMessage}
                        </div>
                    )
                }
            </div>
            {onDismiss && (
                <OverlayTrigger
                    trigger={['hover', 'focus']}
                    delayShow={Constants.OVERLAY_TIME_DELAY}
                    placement='left'
                    overlay={closeBtnTooltip || (
                        <Tooltip id={tooltipId}>{closeText}</Tooltip>
                    )}
                >
                    <button
                        aria-label={closeText}
                        className='AlertBanner__closeButton'
                        onClick={onDismiss}
                    >
                        <CloseIcon
                            size={18}
                        />
                    </button>
                </OverlayTrigger>
            )}
        </div>
    );
};

export default AlertBanner;
