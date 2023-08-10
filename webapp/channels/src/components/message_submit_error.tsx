// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {isErrorInvalidSlashCommand} from 'utils/post_utils';

import type {ServerError} from '@mattermost/types/errors';
import type {MouseEventHandler} from 'react';

interface Props {
    error: ServerError;
    handleSubmit: MouseEventHandler<HTMLAnchorElement>;
    submittedMessage?: string;
}

function MessageSubmitError(props: Props) {
    if (isErrorInvalidSlashCommand(props.error)) {
        const slashCommand = props.submittedMessage?.split(' ')[0];

        return (
            <div className='has-error'>
                <label className='control-label'>
                    <FormattedMessage
                        id='message_submit_error.invalidCommand'
                        defaultMessage="Command with a trigger of ''{slashCommand}'' not found. "
                        values={{
                            slashCommand,
                        }}
                    />
                    <a
                        href='#'
                        onClick={props.handleSubmit}
                    >
                        <FormattedMessage
                            id='message_submit_error.sendAsMessageLink'
                            defaultMessage='Click here to send as a message.'
                        />
                    </a>
                </label>
            </div>
        );
    }

    if (props.error?.message?.trim()?.length === 0) {
        return null;
    }

    return (
        <div className='has-error'>
            <label className='control-label'>{props.error.message.trim()}</label>
        </div>
    );
}

export default MessageSubmitError;
