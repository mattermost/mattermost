// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch} from 'react-redux';

import {DownloadOutlineIcon} from '@mattermost/compass-icons/components';
import {Button} from '@mattermost/shared/components/button';
import type {
    AccessControlPolicy,
    PolicySimulationByUsersParams,
    PolicySimulationUserOverride,
} from '@mattermost/types/access_control';

import {exportSimulationCSV} from 'mattermost-redux/actions/access_control';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

type Props = {
    policy: AccessControlPolicy;
    users: PolicySimulationUserOverride[];
    actions: string[];
    channelId?: string;
    teamId?: string;
    evaluationScope: string;
    disabled?: boolean;
};

/**
 * ExportCSVButton renders a small download button alongside the Simulate
 * Access picker. When clicked it runs the same simulation the picker uses
 * and streams the results as a CSV file download, letting compliance and
 * audit stakeholders consume the data outside the System Console.
 */
const ExportCSVButton: React.FC<Props> = ({
    policy,
    users,
    actions,
    channelId,
    teamId,
    evaluationScope,
    disabled,
}) => {
    const dispatch = useDispatch<DispatchFunc>();
    const [exporting, setExporting] = useState(false);

    const handleExport = useCallback(async () => {
        if (exporting || users.length === 0) {
            return;
        }
        setExporting(true);

        const params: PolicySimulationByUsersParams = {
            policy,
            users,
            actions,
            channel_id: channelId ?? '',
            team_id: teamId ?? '',
            evaluation_scope: evaluationScope,
        };

        try {
            const result = await dispatch(exportSimulationCSV(params));
            if ('data' in result && result.data) {
                const url = URL.createObjectURL(result.data);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'simulation_results.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } finally {
            setExporting(false);
        }
    }, [dispatch, exporting, policy, users, actions, channelId, teamId, evaluationScope]);

    return (
        <Button
            size='sm'
            variant='tertiary'
            onClick={handleExport}
            disabled={disabled || exporting || users.length === 0}
            aria-label='Export simulation results as CSV'
        >
            <DownloadOutlineIcon size={16}/>
            <FormattedMessage
                id='admin.access_control.simulate.export_csv'
                defaultMessage={exporting ? 'Exporting…' : 'Export CSV'}
            />
        </Button>
    );
};

export default ExportCSVButton;
