// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {restoreRun} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

export const useOnRestoreRun = (playbookRun: PlaybookRun) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const refreshLHS = useLHSRefresh();

    return () => {
        const confirmationMessage = formatMessage({defaultMessage: 'Are you sure you want to restart the run?'});

        const onConfirm = async () => {
            await restoreRun(playbookRun.id);
            refreshLHS();
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title: formatMessage({defaultMessage: 'Confirm restart run'}),
            message: confirmationMessage,
            confirmButtonText: formatMessage({defaultMessage: 'Restart run'}),
            onConfirm,
            onCancel: () => null,
        })));
    };
};
