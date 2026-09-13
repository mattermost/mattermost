// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {PlaybookRun} from 'src/types/playbook_run';
import {PlaybookRunType} from 'src/graphql/generated/graphql';
import {restoreRun} from 'src/client';
import {modals} from 'src/webapp_globals';
import {makeUncontrolledConfirmModalDefinition} from 'src/components/widgets/confirmation_modal';

import {useLHSRefresh} from 'src/components/backstage/lhs_navigation';

export const useOnRestoreRun = (playbookRun: PlaybookRun, location: string = 'backstage') => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const refreshLHS = useLHSRefresh();
    const isChannelChecklist = playbookRun?.type === PlaybookRunType.ChannelChecklist;

    return () => {
        const title = isChannelChecklist ? formatMessage({defaultMessage: 'Confirm resume'}) : formatMessage({defaultMessage: 'Confirm restart'});
        const message = isChannelChecklist ? formatMessage({defaultMessage: 'Are you sure you want to resume {name}?'}, {name: playbookRun.name}) : formatMessage({defaultMessage: 'Are you sure you want to restart {name}?'}, {name: playbookRun.name});
        const confirmButtonText = isChannelChecklist ? formatMessage({defaultMessage: 'Resume'}) : formatMessage({defaultMessage: 'Restart'});

        const onConfirm = async () => {
            if (!playbookRun) {
                return;
            }

            await restoreRun(playbookRun.id);

            // Only refresh LHS when in Backstage, not in RHS
            if (location === 'backstage') {
                refreshLHS();
            }
        };

        dispatch(modals.openModal(makeUncontrolledConfirmModalDefinition({
            show: true,
            title,
            message,
            confirmButtonText,
            onConfirm,
            onCancel: () => null,
        })));
    };
};
