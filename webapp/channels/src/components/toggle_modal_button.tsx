// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type ComponentType, type MouseEvent, type ReactNode} from 'react';
import {useDispatch} from 'react-redux';

import {Button, type ButtonAppearance, type ButtonEmphasis, type ButtonSize} from '@mattermost/compass-ui/components/button';

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

    /**
     * When set, renders a compass-ui Button instead of an unstyled trigger.
     * Prefer this for button-looking CTAs; leave unset for link/menu/icon shells.
     */
    emphasis?: ButtonEmphasis;
    size?: ButtonSize;
    destructive?: boolean;
    appearance?: ButtonAppearance;
};

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
    emphasis,
    size,
    destructive,
    appearance,
}: Props) => {
    const dispatch = useDispatch();

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

    const badge = showUnread ? <span className={'unread-badge'}/> : null;

    // allow callers to provide an onClick which will be called before the modal is shown
    const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
        onClick?.();
        show(e);
    };

    if (emphasis) {
        return (
            <Button
                emphasis={emphasis}
                size={size}
                destructive={destructive}
                appearance={appearance}
                className={className}
                aria-label={ariaLabel}
                onClick={clickHandler}
                id={id}
                disabled={disabled}
                role={role}
            >
                {children}
                {badge}
            </Button>
        );
    }

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
