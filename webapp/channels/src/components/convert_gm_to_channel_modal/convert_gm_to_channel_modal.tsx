// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from "react";
import {Modal} from "react-bootstrap";

export type Props = {
    onExited: () => void,
}

const ConvertGmToChannelModal = (props: Props) => {
    const [show, setShow] = useState<boolean>(true)

    const onHide = useCallback(() => {
        setShow(false);
    }, [])

    return (
        <Modal
            dialogClassName='a11y__modal convert-gm-to-cchannel-modal'
            show={show}
            onHide={onHide}
            onExited={props.onExited}
            role='dialog'
            aria-labelledby='convertGmToChannelModalLabel'
            id='convertGmToChannelModal'
        >
            <Modal.Header closeButton={true}>
                {'Header'}
            </Modal.Header>
            <Modal.Body>
                {'Modal Body'}
            </Modal.Body>
        </Modal>
    )
}

export default ConvertGmToChannelModal
