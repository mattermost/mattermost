// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ReactNode, MouseEventHandler} from 'react';
import {FormattedMessage} from 'react-intl';

import {WithTooltip} from '@mattermost/shared/components/tooltip';

import CloseIcon from 'components/widgets/icons/close_icon';
import UnreadAboveIcon from 'components/widgets/icons/unread_above_icon';
import UnreadBelowIcon from 'components/widgets/icons/unread_below_icon';

import Constants from 'utils/constants';

import './toast.scss';

export type Props = {
    onClick?: MouseEventHandler<HTMLDivElement>;
    onClickMessage?: ReactNode;
    onDismiss?: () => void;
    children?: ReactNode;
    show: boolean;
    showActions?: boolean; //used for showing jump actions
    width: number;
    extraClasses?: string;
    jumpDirection?: 'up' | 'down';

    testIdScope?: string;

    /** Which toast this is (`unread`, `history`...). */
    testKey?: string;
};

export default function Toast({
    onClick,
    onClickMessage,
    onDismiss,
    children,
    show,
    showActions,
    width,
    extraClasses = '',
    jumpDirection = 'down',
    testIdScope,
    testKey,
}: Props) {
    function handleDismiss() {
        if (typeof onDismiss === 'function') {
            onDismiss();
        }
    }

    const toastClass = classNames('toast', {
        toast__visible: show,
        [extraClasses]: extraClasses.length > 0,
    });

    const toastActionClass = classNames('toast__message', {
        toast__pointer: showActions,
    });

    return (
        <div
            className={toastClass}
            data-testid={testIdScope && testKey ? `${testIdScope}:${testKey}` : undefined}
        >
            <div
                className={toastActionClass}
                onClick={showActions ? onClick : undefined}
                role={showActions ? 'button' : undefined}
                data-testid={showActions && testIdScope ? `${testIdScope}.jump--button` : undefined}
            >
                {showActions && (
                    <div className='toast__jump'>
                        {jumpDirection === 'down' ? (<UnreadBelowIcon/>) : (<UnreadAboveIcon/>)}
                        {width > Constants.MOBILE_SCREEN_WIDTH && onClickMessage}
                    </div>
                )}
                {children}
            </div>
            <WithTooltip
                title={
                    <>
                        <FormattedMessage
                            id='general_button.close'
                            defaultMessage='Close'
                        />
                        <div className='tooltip__shortcut--txt'>
                            <FormattedMessage
                                id='general_button.esc'
                                defaultMessage='Esc'
                            />
                        </div>
                    </>
                }
                disabled={!showActions || !show}
            >
                <div
                    className='toast__dismiss'
                    onClick={handleDismiss}
                    role='button'
                    data-testid={testIdScope ? `${testIdScope}.dismiss--button` : undefined}
                >
                    <CloseIcon
                        className='close-btn'
                        id='dismissToast'
                    />
                </div>
            </WithTooltip>
        </div>
    );
}
