// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Modal} from 'react-bootstrap';
import {defineMessages, FormattedMessage} from 'react-intl';

import type {LogObject} from '@mattermost/types/admin';

import Button from 'components/button';

type Props = {
    log: LogObject | null;
    onModalDismissed: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    show: boolean;
}

type State = {
    copySuccess: boolean;
}

const messages = defineMessages({
    cancel: {id: 'admin.manage_roles.cancel', defaultMessage: 'Cancel'},
    copyLog: {id: 'admin.server_logs.CopyLog', defaultMessage: 'Copy log'},
});

export default class FullLogEventModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            copySuccess: false,
        };
    }

    renderContents = () => {
        const {log} = this.props;

        if (log == null) {
            return <div/>;
        }

        return (
            <div>
                <pre>
                    {JSON.stringify(this.props.log, undefined, 2)}
                </pre>
            </div>
        );
    };

    copyLog = () => {
        navigator.clipboard.writeText(JSON.stringify(this.props.log, undefined, 2));
        this.showCopySuccess();
    };

    showCopySuccess = () => {
        this.setState({
            copySuccess: true,
        });

        setTimeout(() => {
            this.setState({
                copySuccess: false,
            });
        }, 3000);
    };

    render() {
        return (
            <Modal
                show={this.props.show}
                onHide={this.props.onModalDismissed}
                dialogClassName='a11y__modal full-log-event'
                role='dialog'
                aria-labelledby='fullLogEventModalLabel'
            >
                <Modal.Header closeButton={true}>
                    <Modal.Title
                        componentClass='h1'
                        id='fullLogEventModalLabel'
                    >
                        <FormattedMessage
                            id='admin.server_logs.LogEvent'
                            defaultMessage='Log Event'
                        />
                    </Modal.Title>
                    {this.state.copySuccess ? (
                        <FormattedMessage
                            id='admin.server_logs.DataCopied'
                            defaultMessage='Data copied'
                        />
                    ) : (
                        <Button
                            emphasis='link'
                            onClick={this.copyLog}
                            label={messages.copyLog}
                        />
                    )}
                </Modal.Header>
                <Modal.Body>
                    {this.renderContents()}
                </Modal.Body>
                <Modal.Footer>
                    <Button
                        emphasis='tertiary'
                        onClick={this.props.onModalDismissed}
                        label={messages.cancel}
                    />
                </Modal.Footer>
            </Modal>
        );
    }
}
