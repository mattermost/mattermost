// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {ReactNode} from 'react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';
import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';

import MessageSubmitError from 'components/message_submit_error';
import MsgTyping from 'components/msg_typing';

interface Props {
    postError?: ReactNode;
    errorClass: string | null;
    serverError: ServerError & {submittedMessage?: string} | null;
    channelId: Channel['id'];
    rootId: Post['id'];
    noArgumentHandleSubmit: () => void;
    isInEditMode: boolean;
}

export default function Footer({
    postError,
    errorClass,
    serverError,
    channelId,
    rootId,
    noArgumentHandleSubmit,
    isInEditMode,
}: Props) {
    return (
        <div
            id='postCreateFooter'
            role='form'
            className='AdvancedTextEditor__footer'
        >
            {postError && (
                <div className={classNames('post-error', {errorClass})}>
                    {postError}
                </div>
            )}
            {serverError && (
                <MessageSubmitError
                    error={serverError}
                    submittedMessage={serverError.submittedMessage}
                    handleSubmit={noArgumentHandleSubmit}
                />
            )}
            {!isInEditMode && (
                <MsgTyping
                    channelId={channelId}
                    rootId={rootId}
                />
            )}
        </div>
    );
}
