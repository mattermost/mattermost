// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React, {useMemo} from 'react';
import {useIntl} from 'react-intl';

import {
    AlertOutlineIcon,
    CheckIcon,
    CloseIcon,
    InformationOutlineIcon,
} from '@mattermost/compass-icons/components';

import WithTooltip from 'components/with_tooltip';

import './alert_banner.scss';

export type ModeType = 'danger' | 'warning' | 'info' | 'success';

export type AlertBannerProps = {
    id?: string;
    mode: ModeType;
    title?: ReactNode;
    customIcon?: ReactNode;
    message?: ReactNode;
    children?: ReactNode;
    className?: string;
    hideIcon?: boolean;
    actionButtonLeft?: ReactNode;
    actionButtonRight?: ReactNode;
    footerMessage?: ReactNode;
    closeBtnTooltip?: string;
    onDismiss?: () => void;
    variant?: 'sys' | 'app';
}

const AlertBanner = ({
    id,
    mode,
    title,
    customIcon,
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

    const bannerIcon = useMemo(() => {
        if (customIcon) {
            return customIcon;
        }

        if (mode === 'danger' || mode === 'warning') {
            return <AlertOutlineIcon size={24}/>;
        } else if (mode === 'success') {
            return <CheckIcon size={24}/>;
        }
        return <InformationOutlineIcon size={24}/>;
    }, [mode, customIcon]);

    const dismissButton = useMemo(() => {
        return (
            <button
                className='AlertBanner__closeButton'
                aria-label={formatMessage({id: 'alert_banner.tooltipCloseBtn', defaultMessage: 'Close'})}
                onClick={onDismiss}
            >
                <CloseIcon size={18}/>
            </button>
        );
    }, [onDismiss]);

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
                    {bannerIcon}
                </div>
            )}
            <div className='AlertBanner__body'>
                {title &&
                    <div className='AlertBanner__title'>
                        {title}
                    </div>
                }
                {message && (
                    <div
                        className={classNames({AlertBanner__message: Boolean(title)})}
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
                {footerMessage && (
                    <div className='AlertBanner__footerMessage'>
                        {footerMessage}
                    </div>
                )}
            </div>
            {onDismiss && closeBtnTooltip && (
                <WithTooltip
                    id={`alertBannerTooltip_${id}`}
                    title={closeBtnTooltip}
                    placement='left'
                >
                    {dismissButton}
                </WithTooltip>
            )}
            {onDismiss && !closeBtnTooltip && (
                dismissButton
            )}
        </div>
    );
};

export default AlertBanner;
