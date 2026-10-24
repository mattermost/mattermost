// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Toast} from '@mattermost/compass-ui/components/toast';
import classNames from 'classnames';
import React, {useEffect, useCallback, useRef, type JSX} from 'react';
import {useIntl} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import './info_toast.scss';

const VALID_POSITIONS = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as const;
export type ToastPosition = typeof VALID_POSITIONS[number];
const DEFAULT_POSITION: ToastPosition = 'bottom-right';

type Props = {
    content: {
        icon?: JSX.Element;
        message: string;
        undo?: () => void;
    };
    className?: string;
    position?: ToastPosition;
    onExited: () => void;
};

function InfoToast({content, onExited, className, position = DEFAULT_POSITION}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const nodeRef = useRef<HTMLDivElement>(null);

    // Validate position and fallback to default if invalid
    const validatedPosition = VALID_POSITIONS.includes(position) ? position : DEFAULT_POSITION;

    const closeToast = useCallback(() => {
        onExited();
    }, [onExited]);

    const undoTodo = useCallback(() => {
        content.undo?.();
        onExited();
    }, [content.undo, onExited]);

    const toastContainerClassname = classNames('info-toast', `info-toast--${validatedPosition}`, className);

    useEffect(() => {
        const timer = setTimeout(() => {
            onExited();
        }, 5000);

        return () => clearTimeout(timer);
    }, [onExited]);

    const undoLabel = formatMessage({
        id: 'post_info.edit.undo',
        defaultMessage: 'Undo',
    });

    const dismissLabel = formatMessage({id: 'general_button.close', defaultMessage: 'Close'});

    return (
        <CSSTransition
            in={Boolean(content)}
            nodeRef={nodeRef}
            classNames='toast'
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={300}
            appear={true}
        >
            <div
                ref={nodeRef}
                className={toastContainerClassname}
            >
                <Toast
                    className='info-toast__compass'
                    message={content.message}
                    icon={content.icon}
                    type='general'
                    actionLabel={content.undo ? undoLabel : undefined}
                    onAction={content.undo ? undoTodo : undefined}
                    onDismiss={closeToast}
                    dismissLabel={dismissLabel}
                />
            </div>
        </CSSTransition>
    );
}

export default React.memo(InfoToast);
