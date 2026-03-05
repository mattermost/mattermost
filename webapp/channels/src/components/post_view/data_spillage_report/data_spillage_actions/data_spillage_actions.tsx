// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import './data_spillage_actions.scss';
import type {Post} from '@mattermost/types/posts';
import type {UserProfile} from '@mattermost/types/users';

import {closeModal, openModal} from 'actions/views/modals';

import KeepRemoveFlaggedMessageConfirmationModal
    from 'components/remove_flagged_message_confirmation_modal/remove_flagged_message_confirmation_modal';

import {ModalIdentifiers} from 'utils/constants';

type Props = {
    flaggedPost: Post;
    reportingUser: UserProfile;
}

export default function DataSpillageAction({flaggedPost, reportingUser}: Props) {
    const dispatch = useDispatch();

    const handleRemoveMessage = useCallback(() => {
        const data = {
            modalId: ModalIdentifiers.REMOVE_FLAGGED_POST,
            dialogType: KeepRemoveFlaggedMessageConfirmationModal,
            dialogProps: {
                flaggedPost,
                reportingUser,
                action: 'remove' as const,
                onExited: () => closeModal(ModalIdentifiers.REMOVE_FLAGGED_POST),
            },
        };

        dispatch(openModal(data));
    }, [dispatch, flaggedPost, reportingUser]);

    const handleKeepMessage = useCallback(() => {
        const data = {
            modalId: ModalIdentifiers.REMOVE_FLAGGED_POST,
            dialogType: KeepRemoveFlaggedMessageConfirmationModal,
            dialogProps: {
                flaggedPost,
                reportingUser,
                action: 'keep' as const,
                onExited: () => closeModal(ModalIdentifiers.REMOVE_FLAGGED_POST),
            },
        };

        dispatch(openModal(data));
    }, [dispatch, flaggedPost, reportingUser]);

    return (
        <div
            className='DataSpillageAction'
            data-testid='data-spillage-action'
        >
            <button
                className='btn btn-danger btn-sm'
                data-testid='data-spillage-action-remove-message'
                onClick={handleRemoveMessage}
            >
                <FormattedMessage
                    id='data_spillage_report.remove_message.button_text'
                    defaultMessage='Remove message'
                />
            </button>

            <button
                className='btn btn-tertiary btn-sm'
                data-testid='data-spillage-action-keep-message'
                onClick={handleKeepMessage}
            >
                <FormattedMessage
                    id='data_spillage_report.keep_message.button_text'
                    defaultMessage='Keep message'
                />
            </button>
        </div>
    );
}
