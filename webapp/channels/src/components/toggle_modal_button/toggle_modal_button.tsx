// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ComponentType, MouseEvent, ReactNode} from 'react';
import {useIntl} from 'react-intl';

import {ModalData} from 'types/actions';

import {Button, ButtonProps} from '@mattermost/compass-ui';

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
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
} & ButtonProps;

const ToggleModalButton = ({
    id,
    role,
    ariaLabel,
    children,
    modalId,
    dialogType,
    onClick,
    showUnread,
    disabled,
    actions,
    dialogProps = {},
    className = '',
    ...rest
}: Props) => {
    const intl = useIntl();

    const show = (e: MouseEvent<HTMLButtonElement>) => {
        e?.preventDefault();

        const modalData = {
            modalId,
            dialogProps,
            dialogType,
        };

        actions.openModal(modalData);
    };

    const ariaLabelElement = ariaLabel ? intl.formatMessage({
        id: 'accessibility.button.dialog',
        defaultMessage: '{dialogName} dialog',
    }, {
        dialogName: ariaLabel,
    }) : undefined;

    const badge = showUnread ? <span className={'unread-badge'}/> : null;

    // allow callers to provide an onClick which will be called before the modal is shown
    const clickHandler = (e: MouseEvent<HTMLButtonElement>) => {
        onClick?.();
        show(e);
    };

    return (
        <Button
            id={id}
            role={role}
            className={className}
            onClick={clickHandler}
            disabled={disabled}
            aria-label={ariaLabelElement}
            {...rest}
        >
            {children}
            {badge}
        </Button>
    );
};

export default ToggleModalButton;
