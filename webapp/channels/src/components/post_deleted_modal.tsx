// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, memo, useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

type Props = {
    onExited: () => void;
}

const PostDeletedModal = ({
    onExited,
}: Props) => {
    const [show, setShow] = useState(true);

    const handleHide = useCallback(() => setShow(false), []);

    return (
        <Modal
            dialogClassName='a11y__modal'
            show={show}
            onHide={handleHide}
            onExited={onExited}
            role='dialog'
            aria-labelledby='postDeletedModalLabel'
            data-testid='postDeletedModal'
        >
            <Modal.Header closeButton={true}>
                <Modal.Title
                    componentClass='h1'
                    id='postDeletedModalLabel'
                >
                    <FormattedMessage
                        id='post_delete.notPosted'
                        defaultMessage='Comment could not be posted'
                    />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>
                    <FormattedMessage
                        id='post_delete.someone'
                        defaultMessage='Someone deleted the message on which you tried to post a comment.'
                    />
                </p>
            </Modal.Body>
            <Modal.Footer>
                <button
                    type='button'
                    className='btn btn-primary'
                    autoFocus={true}
                    onClick={handleHide}
                    data-testid='postDeletedModalOkButton'
                >
                    <FormattedMessage
                        id='post_delete.okay'
                        defaultMessage='Okay'
                    />
                </button>
            </Modal.Footer>
        </Modal>
    );
};

export default memo(PostDeletedModal);
