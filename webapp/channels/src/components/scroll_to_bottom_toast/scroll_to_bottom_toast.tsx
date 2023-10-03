// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import CloseIcon from 'components/widgets/icons/close_icon';
import UnreadBelowIcon from 'components/widgets/icons/unread_below_icon';

import './scroll_to_bottom_toast.scss';

type ScrollToBottomToastProps = {
    onDismiss: () => void;
    onClick: () => void;
}

export const ScrollToBottomToast = ({onDismiss, onClick}: ScrollToBottomToastProps) => {
    const {formatMessage} = useIntl();

    const jumpToRecentsMessage = formatMessage({
        id: 'postlist.toast.scrollToBottom',
        defaultMessage: 'Jump to recents',
    });

    const handleScrollToBottom: React.MouseEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        onClick();
    };

    const handleDismiss: React.MouseEventHandler<HTMLDivElement> = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDismiss();
    };

    return (
        <div
            className='scroll-to-bottom-toast'
            onClick={handleScrollToBottom}
        >
            <UnreadBelowIcon/>
            {jumpToRecentsMessage}
            <div
                className='scroll-to-bottom-toast__dismiss'
                onClick={handleDismiss}
                data-testid='dismissScrollToBottomToast'
            >
                <CloseIcon
                    className='close-btn'
                    id='dismissScrollToBottomToast'
                />
            </div>
        </div>
    );
};

export default ScrollToBottomToast;
