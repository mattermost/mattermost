// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {toggleRunStatusUpdates} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

export const useToggleRunStatusUpdate = (playbookRun: PlaybookRun) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();

    return (status: boolean) => {
        const confirmTitle = status ? formatMessage({defaultMessage: 'Confirm enable status updates'}) : formatMessage({defaultMessage: 'Confirm disable status updates'});
        const confirmationMessage = status ? formatMessage({defaultMessage: 'Are you sure you want to enable status updates for this run?'}) : formatMessage({defaultMessage: 'Are you sure you want to disable status updates for this run?'});

        const onConfirm = async () => {
            await toggleRunStatusUpdates(playbookRun.id, status);
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: confirmTitle,
            message: confirmationMessage,
            confirmButtonText: status ? formatMessage({defaultMessage: 'Enable updates'}) : formatMessage({defaultMessage: 'Disable updates'}),
            onConfirm,
            onCancel: () => null,
        })));
    };
};
