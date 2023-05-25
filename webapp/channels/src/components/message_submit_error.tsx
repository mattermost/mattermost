// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {ReactFragment} from 'react';
import {FormattedMessage} from 'react-intl';

import {ServerError} from '@mattermost/types/errors';

import {isErrorInvalidSlashCommand} from 'utils/post_utils';

interface MessageSubmitErrorProps {
    error: ServerError;
    handleSubmit: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => void;
    submittedMessage?: string;
}

class MessageSubmitError extends React.PureComponent<MessageSubmitErrorProps> {
    public renderSlashCommandError = (): string | ReactFragment => {
        if (!this.props.submittedMessage) {
            return this.props.error.message;
        }

        const command = this.props.submittedMessage.split(' ')[0];
        return (
            <React.Fragment>
                <FormattedMessage
                    id='message_submit_error.invalidCommand'
                    defaultMessage="Command with a trigger of ''{command}'' not found. "
                    values={{
                        command,
                    }}
                />
                <a
                    href='#'
                    onClick={this.props.handleSubmit}
                >
                    <FormattedMessage
                        id='message_submit_error.sendAsMessageLink'
                        defaultMessage='Click here to send as a message.'
                    />
                </a>
            </React.Fragment>
        );
    };

    public render(): JSX.Element | null {
        const error = this.props.error;

        if (!error) {
            return null;
        }

        let errorContent: string | ReactFragment = error.message;
        if (isErrorInvalidSlashCommand(error)) {
            errorContent = this.renderSlashCommandError();
        }

        return (
            <div className='has-error'>
                <label className='control-label'>
                    {errorContent}
                </label>
            </div>
        );
    }
}

export default MessageSubmitError;
