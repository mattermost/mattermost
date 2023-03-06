// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import styled from 'styled-components';
import {Modal} from 'react-bootstrap';

import GenericModal, {DefaultFooterContainer} from 'src/components/widgets/generic_modal';

interface Props {
    show: boolean;
    title: React.ReactNode;
    message: React.ReactNode;
    confirmButtonText: React.ReactNode;
    isConfirmDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
    components?: Partial<{
        Header: typeof Modal.Header;
        FooterContainer: typeof DefaultFooterContainer;
    }>;
}

const ConfirmModalLight = ({
    show,
    title,
    message,
    confirmButtonText,
    isConfirmDestructive,
    onConfirm,
    onCancel,
    components,
}: Props) => {
    return (
        <ConfirmModal
            id={'confirm-modal-light'}
            show={show}
            isConfirmDestructive={isConfirmDestructive}
            confirmButtonText={<div id='confirm-modal-light-button'>{confirmButtonText}</div>}
            autoCloseOnCancelButton={true}
            autoCloseOnConfirmButton={true}
            handleConfirm={onConfirm}
            handleCancel={onCancel}
            onHide={onCancel}
            components={{
                FooterContainer: ConfirmModalFooter,
                ...components,
            }}
        >
            <ConfirmModalTitle>{title}</ConfirmModalTitle>
            <ConfirmModalMessage>{message}</ConfirmModalMessage>
        </ConfirmModal>
    );
};

const ConfirmModal = styled(GenericModal)`
    width: 512px;
`;

const ConfirmModalTitle = styled.h1`
    font-family: Metropolis;
    font-size: 22px;
    line-height: 28px;

    text-align: center;
    color: var(--center-channel-color);
`;

const ConfirmModalMessage = styled.div`
    font-size: 14px;
    text-align: center;

    padding: 0 16px;
    margin: 0;
    margin-top: 8px;
    margin-bottom: 12px;
`;

const ConfirmModalFooter = styled(DefaultFooterContainer)`
    align-items: center;
    margin-bottom: 24px;
`;

export default ConfirmModalLight;
