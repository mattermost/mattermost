// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {openModal} from 'actions/views/modals';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    name: string;
    onConfirm: () => void;
    onExited: () => void;
    isOrphaned?: boolean;
    sourcePluginId?: string;
};

// GenericModal only renders a Cancel button when handleCancel is supplied, and
// cancelling needs no side effect here beyond closing — same shape as
// user_properties_delete_modal.
const noop = () => {};

/**
 * Opens the delete-confirmation modal for a Global Attribute. The modal is
 * display-only: `onConfirm` fires the caller's own delete logic, which owns the
 * API call and its error handling. Mirrors useUserPropertyFieldDelete /
 * useBoardAttributeFieldDelete, but passes the callback in rather than resolving
 * a Promise, since the caller's handler is async and reports its own failures.
 *
 * Pass `orphan` when the field's source plugin is no longer installed, so the
 * confirmation can explain where the leftover attribute came from. It is an
 * object rather than a bare flag so there is no way to declare a field orphaned
 * without supplying the plugin it came from.
 *
 * `onExited` runs once the modal has finished closing, whether it was confirmed
 * or cancelled. ModalController composes it with its own close handling, so the
 * caller's callback runs after the dialog is actually gone -- which is when it is
 * safe to move focus or scroll, since react-bootstrap restores focus to whatever
 * opened the modal on the way out.
 */
export const useGlobalAttributeFieldDelete = () => {
    const dispatch = useDispatch();

    return (name: string, onConfirm: () => void, orphan?: {sourcePluginId?: string}, onExited?: () => void) => {
        dispatch(openModal({
            modalId: ModalIdentifiers.GLOBAL_ATTRIBUTE_FIELD_DELETE,
            dialogType: GlobalAttributeDeleteModal,
            dialogProps: {
                name,
                onConfirm,
                isOrphaned: Boolean(orphan),
                sourcePluginId: orphan?.sourcePluginId,
                onExited,
            },
        }));
    };
};

function GlobalAttributeDeleteModal({name, onConfirm, onExited, isOrphaned = false, sourcePluginId}: Props) {
    const {formatMessage} = useIntl();

    const title = formatMessage({
        id: 'admin.global_attributes.confirm.delete.title',
        defaultMessage: 'Delete {name} attribute',
    }, {name});

    const confirmButtonText = formatMessage({
        id: 'admin.system_properties.confirm.delete.button',
        defaultMessage: 'Delete',
    });

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            confirmButtonVariant='destructive'
            handleCancel={noop}
            handleConfirm={onConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
        >
            {/* An uninstalled plugin leaves no manifest behind to resolve a display
                name from, so the raw source_plugin_id is the only identifier we can
                honestly show here. */}
            {isOrphaned && (
                <p>
                    <FormattedMessage
                        id='admin.global_attributes.confirm.delete.orphaned_body'
                        defaultMessage='This attribute was created by the plugin "{pluginId}", which is no longer installed.'
                        values={{pluginId: sourcePluginId || 'unknown'}}
                    />
                </p>
            )}
            <FormattedMessage
                id='admin.global_attributes.confirm.delete.body'
                defaultMessage='Deleting this attribute will permanently remove its definition. This action cannot be undone.'
            />
        </GenericModal>
    );
}

export default GlobalAttributeDeleteModal;
