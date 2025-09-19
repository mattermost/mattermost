// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState, memo} from 'react';
import {Button, Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {LogObject} from '@mattermost/types/admin';

type Props = {
    log: LogObject | null;
    onModalDismissed: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    show: boolean;
}

const FullLogEventModal = ({
    log,
    show,
    onModalDismissed,
}: Props) => {
    const [copySuccess, setCopySuccess] = useState(false);

    const showCopySuccess = () => {
        setCopySuccess(true);

        setTimeout(() => {
            setCopySuccess(false);
        }, 3000);
    };

    const copyLog = useCallback(() => {
        navigator.clipboard.writeText(JSON.stringify(log, undefined, 2));
        showCopySuccess();
    }, [log, showCopySuccess]);

    return (
        <Modal
            show={show}
            onHide={onModalDismissed}
            dialogClassName='a11y__modal full-log-event'
            role='none'
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
                {copySuccess ? (
                    <FormattedMessage
                        id='admin.server_logs.DataCopied'
                        defaultMessage='Data copied'
                    />
                ) : (
                    <Button onClick={copyLog}>
                        <FormattedMessage
                            id='admin.server_logs.CopyLog'
                            defaultMessage='Copy log'
                        />
                    </Button>
                )}
            </Modal.Header>
            <Modal.Body>
                {
                    log === null ? <div/> : <div>
                        <pre>
                            {JSON.stringify(log, undefined, 2)}
                        </pre>
                    </div>
                }
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn btn-tertiary'
                    onClick={onModalDismissed}
                >
                    <FormattedMessage
                        id='admin.manage_roles.cancel'
                        defaultMessage='Cancel'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default memo(FullLogEventModal);
