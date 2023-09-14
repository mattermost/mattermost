// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import type {ComponentType, MouseEvent, ReactNode} from 'react';
import {useIntl} from 'react-intl';

import type {ModalData} from 'types/actions';

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
};

const ToggleModalButton = ({ariaLabel, children, modalId, dialogType, dialogProps = {}, onClick, className = '', showUnread, disabled, id, actions, role}: Props) => {
    const intl = useIntl();

    const show = (e: MouseEvent<HTMLButtonElement>) => {
        if (e) {
            e.preventDefault();
        }

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
        <button
            className={'style--none ' + className}
            aria-label={ariaLabelElement}
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
