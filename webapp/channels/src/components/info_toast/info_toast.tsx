// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect, useCallback} from 'react';
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
}

function InfoToast({content, onExited, className, position = DEFAULT_POSITION}: Props): JSX.Element {
    const {formatMessage} = useIntl();

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

    return (
        <CSSTransition
            in={Boolean(content)}
            classNames='toast'
            mountOnEnter={true}
            unmountOnExit={true}
            timeout={300}
            appear={true}
        >
            <div className={toastContainerClassname}>
                {content.icon}
                <span>{content.message}</span>
                {content.undo && (
                    <button
                        onClick={undoTodo}
                        className='info-toast__undo'
                    >
                        {formatMessage({
                            id: 'post_info.edit.undo',
                            defaultMessage: 'Undo',
                        })}
                    </button>
                )}
                <button
                    className='info-toast__icon_button'
                    onClick={closeToast}
                    aria-label={formatMessage({id: 'general_button.close', defaultMessage: 'Close'})}
                >
                    <i className='icon icon-close'/>
                </button>
            </div>
        </CSSTransition>
    );
}

export default React.memo(InfoToast);
