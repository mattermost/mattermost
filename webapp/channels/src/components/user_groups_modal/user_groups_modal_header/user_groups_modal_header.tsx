// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {Modal} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import CreateUserGroupsModal from 'components/create_user_groups_modal';

import type {ModalData} from 'types/actions';
import {ModalIdentifiers} from 'utils/constants';

export type Props = {
    canCreateCustomGroups: boolean;
    onExited: () => void;
    backButtonAction: () => void;
    actions: {
        openModal: <P>(modalData: ModalData<P>) => void;
    };
}

const UserGroupsModalHeader = (props: Props) => {
    const goToCreateModal = useCallback(() => {
        props.actions.openModal({
            modalId: ModalIdentifiers.USER_GROUPS_CREATE,
            dialogType: CreateUserGroupsModal,
            dialogProps: {
                backButtonCallback: props.backButtonAction,
            },
        });
        props.onExited();
    }, [props.actions.openModal, props.backButtonAction, props.onExited]);

    return (
        <Modal.Header closeButton={true}>
            <Modal.Title
                componentClass='h1'
                id='userGroupsModalLabel'
            >
                <FormattedMessage
                    id='user_groups_modal.title'
                    defaultMessage='User Groups'
                />
            </Modal.Title>
            {
                props.canCreateCustomGroups &&
                <button
                    className='user-groups-create btn btn-md btn-primary'
                    onClick={goToCreateModal}
                >
                    <FormattedMessage
                        id='user_groups_modal.createNew'
                        defaultMessage='Create Group'
                    />
                </button>
            }
        </Modal.Header>
    );
};

export default React.memo(UserGroupsModalHeader);
