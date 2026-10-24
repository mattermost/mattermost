// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {UnreadBadge} from '@mattermost/compass-ui/components/unread-badge';
import React, {type ComponentType, type MouseEvent, type ReactNode} from 'react';
import {defineMessages, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {openModal} from 'actions/views/modals';

type Props = {
    ariaLabel?: string;
    children: ReactNode;
    modalId: string;
    dialogType: ComponentType<any>;
    dialogProps?: Record<string, any>;
    onClick?: () => void;
    className?: string;
    showUnread?: boolean;
    disabled?: boolean;
    id?: string;
    role?: string;
};

const messages = defineMessages({
    unreadBadgeAriaLabel: {
        id: 'unread_badge.aria_label',
        defaultMessage: 'Unread',
    },
});

const ToggleModalButton = ({
    ariaLabel,
    children,
    modalId,
    dialogType,
    dialogProps = {},
    onClick,
    className = '',
    showUnread,
    disabled,
    id,
    role,
}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    const show = (e: MouseEvent<HTMLButtonElement>) => {
        if (e) {
            e.preventDefault();
        }

        const modalData = {
            modalId,
            dialogProps,
            dialogType,
        };

        dispatch(openModal(modalData));
    };

    const badge = showUnread ? (
        <UnreadBadge
            className='unread-badge'
            context='icon-button'
            aria-label={formatMessage(messages.unreadBadgeAriaLabel)}
        />
    ) : null;

    // allow callers to provide an onClick which will be called before the modal is shown
    const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
        onClick?.();
        show(e);
    };

    return (
        <button
            className={'style--none ' + className}
            aria-label={ariaLabel}
            onClick={clickHandler}
            id={id}
            disabled={disabled}
            role={role}
        >
            {children}
            {badge}
        </button>
    );
};

export default ToggleModalButton;
