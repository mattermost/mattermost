// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {Button, Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {LogObject} from '@mattermost/types/admin';

type Props = {
    log: LogObject | null;
    onModalDismissed: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    show: boolean;
}

type State = {
    copySuccess: boolean;
    exportSuccess: boolean;
}

export default class FullLogEventModal extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            copySuccess: false,
            exportSuccess: false,
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

    exportToCsv = () => {
        const file = navigator.clipboard.writeText(JSON.stringify(this.props.log, undefined, 2));
        const csvContent = 'data:text/csv;charset=utf-8,' + file;
        const encodedUri = encodeURI(csvContent);
        window.open(encodedUri);
        this.showExportSuccess();
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

    showExportSuccess = () => {
        this.setState({
            exportSuccess: true,
        });

        setTimeout(() => {
            this.setState({
                exportSuccess: false,
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
                        <Button onClick={this.copyLog}>
                            <FormattedMessage
                                id='admin.server_logs.CopyLog'
                                defaultMessage='Copy log'
                            />
                        </Button>
                    )}
                </Modal.Header>
                <Modal.Body>
                    {this.renderContents()}
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type='button'
                        className='btn btn-link'
                        onClick={this.props.onModalDismissed}
                    >
                        <FormattedMessage
                            id='admin.manage_roles.cancel'
                            defaultMessage='Cancel'
                        />
                    </button>
                    {this.state.exportSuccess ? (
                        <FormattedMessage
                            id='admin.server_logs.Exported'
                            defaultMessage='Exported'
                        />
                    ) : (
                        <Button onClick={this.exportToCsv}>
                            <FormattedMessage
                                id='admin.server_logs.Export'
                                defaultMessage='Export'
                            />
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        );
    }
}
