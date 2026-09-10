// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GrantConfirmRequest} from './graph_parent_ops';

import './attribute_graph_grant_confirm_modal.scss';

type Props = {
    parentName: string;
    childName: string;
    onConfirm: () => void;
    onCancel: () => void;
    onExited: () => void;
};

export function useGrantConfirm(): (req: GrantConfirmRequest) => Promise<boolean> {
    const dispatch = useDispatch();

    return (req: GrantConfirmRequest) => {
        if (req.newlyReachable.length === 0) {
            return Promise.resolve(true);
        }

        return new Promise<boolean>((resolve) => {
            let settled = false;
            const settle = (value: boolean) => {
                if (!settled) {
                    settled = true;
                    resolve(value);
                }
            };

            dispatch(openModal({
                modalId: ModalIdentifiers.GRAPH_GRANT_CONFIRM,
                dialogType: AttributeGraphGrantConfirmModal,
                dialogProps: {
                    parentName: req.parentName,
                    childName: req.childName,
                    onConfirm: () => settle(true),
                    onCancel: () => settle(false),
                    onExited: () => settle(false),
                },
            }));
        });
    };
}

function AttributeGraphGrantConfirmModal({
    parentName,
    childName,
    onConfirm,
    onCancel,
    onExited,
}: Props) {
    const {formatMessage} = useIntl();

    return (
        <GenericModal
            id='attributeGraphGrantConfirmModal'
            className='attribute-graph-grant-confirm-modal'
            compassDesign={true}
            modalHeaderText={formatMessage(messages.title, {parent: parentName})}
            confirmButtonText={formatMessage(messages.confirm)}
            handleConfirm={onConfirm}
            handleCancel={onCancel}
            onExited={onExited}
            dataTestId='attributeGraphGrantConfirmModal'
        >
            <p className='attribute-graph-grant-confirm-modal__lead'>
                <FormattedMessage
                    {...messages.lead}
                    values={{
                        child: <strong>{childName}</strong>,
                        parent: <strong>{parentName}</strong>,
                    }}
                />
            </p>
        </GenericModal>
    );
}

export default AttributeGraphGrantConfirmModal;

const messages = defineMessages({
    title: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.title',
        defaultMessage: 'Add {parent} as a parent?',
    },
    lead: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.lead',
        defaultMessage: '{child} and all of its child values will also sit under {parent}. Are you sure you want to add this parent?',
    },
    confirm: {
        id: 'admin.global_attributes.attribute_details.graph.grant_confirm.confirm',
        defaultMessage: 'Add',
    },
});
