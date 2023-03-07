// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useCallback} from 'react';
import classNames from 'classnames';
import {CSSTransition} from 'react-transition-group';
import {useIntl} from 'react-intl';

import IconButton from '@mattermost/compass-components/components/icon-button';
import './info_toast.scss';

type Props = {
    content: {
        icon?: JSX.Element;
        message: string;
        undo?: () => void;
    };
    className?: string;
    onExited: () => void;
}

function InfoToast({content, onExited, className}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const closeToast = useCallback(() => {
        onExited();
    }, [onExited]);

    const undoTodo = useCallback(() => {
        content.undo?.();
        onExited();
    }, [content.undo, onExited]);

    const toastContainerClassname = classNames('info-toast', className);

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
                <IconButton
                    className='info-toast__icon_button'
                    onClick={closeToast}
                    icon='close'
                    size='sm'
                    inverted={true}
                />
            </div>
        </CSSTransition>
    );
}

export default React.memo(InfoToast);
