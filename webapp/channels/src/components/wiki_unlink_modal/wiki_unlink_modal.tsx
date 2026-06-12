// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {GenericModal} from '@mattermost/components';

import {closeModal} from 'actions/views/modals';

import {useIsMounted} from 'hooks/useIsMounted';
import {ModalIdentifiers} from 'utils/constants';

type Props = {
    wikiTitle: string;
    onConfirm: () => void | Promise<void>;
    onCancel?: () => void;
    onExited: () => void;
};

const renderStrong = (chunk: React.ReactNode) => <strong>{chunk}</strong>;

function WikiUnlinkModal({
    wikiTitle,
    onExited,
    onCancel,
    onConfirm,
}: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [isUnlinking, setIsUnlinking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isMounted = useIsMounted();

    const handleConfirm = useCallback(async () => {
        if (isUnlinking) {
            return;
        }
        setIsUnlinking(true);
        setError(null);
        try {
            await onConfirm();
            if (!isMounted()) {
                return;
            }
            setIsUnlinking(false);
            dispatch(closeModal(ModalIdentifiers.WIKI_UNLINK));
        } catch (error) {
            if (!isMounted()) {
                return;
            }
            setIsUnlinking(false);
            setError(formatMessage({
                id: 'wiki_tab.unlink_error',
                defaultMessage: 'Failed to remove wiki. Please try again.',
            }));
        }
    }, [onConfirm, dispatch, formatMessage, isUnlinking]);

    const title = formatMessage({
        id: 'wiki_tab.unlink_modal_title',
        defaultMessage: 'Remove wiki from channel',
    });

    const confirmButtonText = formatMessage({
        id: 'wiki_tab.unlink_modal_confirm',
        defaultMessage: 'Remove',
    });

    const message = (
        <FormattedMessage
            id={'wiki_tab.unlink_modal_text'}
            defaultMessage={'Remove <strong>{wikiTitle}</strong> from this channel? Members who only have access through this channel will lose wiki access.'}
            values={{
                strong: renderStrong,
                wikiTitle,
            }}
        />
    );

    return (
        <GenericModal
            confirmButtonText={confirmButtonText}
            handleCancel={onCancel}
            handleConfirm={handleConfirm}
            modalHeaderText={title}
            onExited={onExited}
            compassDesign={true}
            confirmButtonVariant='destructive'
            isConfirmDisabled={isUnlinking}
            autoCloseOnConfirmButton={false}
        >
            {message}
            {error && (
                <div
                    className='alert alert-danger mt-2'
                    role='alert'
                >
                    {error}
                </div>
            )}
        </GenericModal>
    );
}

export default WikiUnlinkModal;
