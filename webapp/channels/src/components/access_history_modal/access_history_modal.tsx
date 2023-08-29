// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';
import {Audit} from '@mattermost/types/audits';

type Props = {
    onHide: () => void;
    actions: {
        getUserAudits: (userId: string, page?: number, perPage?: number) => void;
    };
    userAudits: Audit[];
    currentUserId: string;
}

const AccessHistoryModal = ({
    actions: {
        getUserAudits,
    },
    currentUserId,
    onHide,
    userAudits,
}: Props) => {
    const [show, setShow] = useState(true);

    const onCloseClick = useCallback(() => {
        setShow(false);
    }, []);

    useEffect(() => {
        getUserAudits(currentUserId, 0, 200);
    }, []);

    let content;
    if (userAudits.length === 0) {
        content = (<LoadingScreen/>);
    } else {
        content = (
            <AuditTable
                audits={userAudits}
                showIp={true}
                showSession={true}
            />
        );
    }

    return (
        <Modal
            dialogClassName='a11y__modal modal--scroll'
            show={show}
            onHide={onCloseClick}
            onExited={onHide}
            bsSize='large'
            role='dialog'
            aria-labelledby='accessHistoryModalLabel'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='accessHistoryModalLabel'
                >
                    <FormattedMessage
                        id='access_history.title'
                        defaultMessage='Access History'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {content}
            </Modal.Body>
            <Modal.Footer className='modal-footer--invisible'>
                <button
                    id='closeModalButton'
                    type='button'
                    className='btn btn-tertiary'
                >
                    <FormattedMessage
                        id='general_button.close'
                        defaultMessage='Close'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default React.memo(AccessHistoryModal);
