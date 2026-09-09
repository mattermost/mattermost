// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import {resourceTypeLabels} from './attribute_applies_to_constants';
import type {ResourceObjectType} from './attribute_applies_to_constants';

type Props = {
    resourceTypes: ResourceObjectType[];
    onConfirm: () => void;
    onCancel: () => void;
    onExited: () => void;
};

/**
 * Confirms removing Applies-to resources from an existing attribute before
 * Save runs. Removing a resource deletes its linked field, and with it every
 * value any User/Channel/Post has stored under it -- an irreversible
 * deletion. There is no client-facing endpoint to count how many values
 * would be lost (see the plan's Decisions table), so the copy can only name
 * what is at risk, not how many.
 *
 * Resolves the returned promise with false on both explicit Cancel and any
 * other dismissal (backdrop click, Esc) -- handleSave treats "not confirmed"
 * as "don't delete anything" either way, so there is no third outcome to
 * distinguish.
 */
export const useConfirmRemoveAppliesTo = () => {
    const dispatch = useDispatch();

    return (resourceTypes: ResourceObjectType[]): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
            let resolved = false;
            const resolveOnce = (value: boolean) => {
                if (!resolved) {
                    resolved = true;
                    resolve(value);
                }
            };

            dispatch(openModal({
                modalId: ModalIdentifiers.GLOBAL_ATTRIBUTE_REMOVE_APPLIES_TO,
                dialogType: ConfirmRemoveAppliesToModal,
                dialogProps: {
                    resourceTypes,
                    onConfirm: () => resolveOnce(true),
                    onCancel: () => resolveOnce(false),
                    onExited: () => resolveOnce(false),
                },
            }));
        });
    };
};

function ConfirmRemoveAppliesToModal({resourceTypes, onConfirm, onCancel, onExited}: Props) {
    const {formatMessage} = useIntl();

    const resources = resourceTypes.map((type) => formatMessage(resourceTypeLabels[type])).join(', ');

    const title = formatMessage({
        id: 'admin.global_attributes.confirm.remove_applies_to.title',
        defaultMessage: 'Remove {resources}?',
    }, {resources});

    const confirmButtonText = formatMessage({
        id: 'admin.global_attributes.confirm.remove_applies_to.button',
        defaultMessage: 'Remove and save',
    });

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            confirmButtonVariant='destructive'
            handleCancel={onCancel}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
        >
            <FormattedMessage
                id='admin.global_attributes.confirm.remove_applies_to.body'
                defaultMessage='This will permanently delete every value stored for this attribute on {resources}. This action cannot be undone.'
                values={{resources}}
            />
        </GenericModal>
    );
}

export default ConfirmRemoveAppliesToModal;
