// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {
    FloatingFocusManager,
    autoUpdate,
    flip,
    offset,
    safePolygon,
    shift,
    useFloating,
    useHover,
    useId,
    useInteractions,
    useRole,
} from '@floating-ui/react-dom-interactions';
import classNames from 'classnames';
import React, {memo, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {CheckCircleOutlineIcon} from '@mattermost/compass-icons/components';

import {acknowledgePost, unacknowledgePost} from 'mattermost-redux/actions/posts';

import PostAcknowledgementsUserPopover from './post_acknowledgements_users_popover';

import type {Post, PostAcknowledgement} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import './post_acknowledgements.scss';

type Props = {
    authorId: UserProfile['id'];
    currentUserId: UserProfile['id'];
    hasReactions: boolean;
    isDeleted: boolean;
    list?: Array<{user: UserProfile; acknowledgedAt: PostAcknowledgement['acknowledged_at']}>;
    postId: Post['id'];
    showDivider?: boolean;
}

function moreThan5minAgo(time: number) {
    const now = new Date().getTime();
    return now - time > 5 * 60 * 1000;
}

function PostAcknowledgements({
    authorId,
    currentUserId,
    hasReactions,
    isDeleted,
    list,
    postId,
    showDivider = true,
}: Props) {
    let acknowledgedAt = 0;
    const headingId = useId();
    const isCurrentAuthor = authorId === currentUserId;
    const dispatch = useDispatch();
    const [open, setOpen] = useState(false);

    if (list && list.length) {
        const ack = list.find((ack) => ack.user.id === currentUserId);
        if (ack) {
            acknowledgedAt = ack.acknowledgedAt;
        }
    }
    const buttonDisabled = (Boolean(acknowledgedAt) && moreThan5minAgo(acknowledgedAt)) || isCurrentAuthor;

    const {x, y, reference, floating, strategy, context} = useFloating({
        open,
        onOpenChange: setOpen,
        placement: 'top-start',
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(5),
            flip({
                fallbackPlacements: ['bottom-start', 'right'],
                padding: 12,
            }),
            shift({
                padding: 12,
            }),
        ],
    });

    const {getReferenceProps, getFloatingProps} = useInteractions([
        useHover(context, {
            enabled: list && list.length > 0,
            mouseOnly: true,
            delay: {
                open: 300,
                close: 0,
            },
            handleClose: safePolygon({
                blockPointerEvents: false,
                restMs: 100,
            }),
        }),
        useRole(context),
    ]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (buttonDisabled) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (acknowledgedAt) {
            dispatch(unacknowledgePost(postId));
        } else {
            dispatch(acknowledgePost(postId));
        }
    };

    if (isDeleted) {
        return null;
    }

    let buttonText: React.ReactNode = (
        <FormattedMessage
            id={'post_priority.button.acknowledge'}
            defaultMessage={'Acknowledge'}
        />
    );

    if ((list && list.length) || isCurrentAuthor) {
        buttonText = list?.length || 0;
    }

    const button = (
        <>
            <button
                ref={reference}
                onClick={handleClick}
                className={classNames({
                    AcknowledgementButton: true,
                    'AcknowledgementButton--acked': Boolean(acknowledgedAt),
                    'AcknowledgementButton--disabled': buttonDisabled,
                    'AcknowledgementButton--default': !list || list.length === 0,
                })}
                {...getReferenceProps()}
            >
                <CheckCircleOutlineIcon size={16}/>
                {buttonText}
            </button>
            {showDivider && hasReactions && <div className='AcknowledgementButton__divider'/>}
        </>
    );

    if (!list || !list.length) {
        return button;
    }

    return (
        <>
            {button}
            {open && (
                <FloatingFocusManager
                    context={context}
                    modal={false}
                >
                    <div
                        ref={floating}
                        style={{
                            position: strategy,
                            top: y ?? 0,
                            left: x ?? 0,
                            width: 248,
                            zIndex: 999,
                        }}
                        aria-labelledby={headingId}
                        {...getFloatingProps()}
                    >
                        <PostAcknowledgementsUserPopover
                            currentUserId={currentUserId}
                            list={list}
                        />
                    </div>
                </FloatingFocusManager>
            )}
        </>
    );
}

export default memo(PostAcknowledgements);
