// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, memo, useCallback} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Audit} from '@mattermost/types/audits';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ComplianceReports from 'components/admin_console/compliance_reports';
import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';
import AdminPanel from 'components/widgets/admin_console/admin_panel';
import ReloadIcon from 'components/widgets/icons/fa_reload_icon';

type Props = {
    isLicensed: boolean;
    audits: Audit[];
    isDisabled?: boolean;
    actions: {
        getAudits: () => Promise<ActionResult<Audit[]>>;
    };
};

const messages = defineMessages({
    title: {id: 'admin.complianceMonitoring.userActivityLogsTitle', defaultMessage: 'User Activity Logs'},
    reload: {id: 'admin.audits.reload', defaultMessage: 'Reload User Activity Logs'},
});

export const searchableStrings = [
    messages.title,
    messages.reload,
];

const Audits = ({
    isLicensed,
    audits,
    isDisabled,
    actions,
}: Props) => {
    const [isLoadingAudits, setIsLoadingAudits] = useState(true);

    useEffect(() => {
        actions.getAudits().then(() => setIsLoadingAudits(false));

        /* eslint-disable-next-line react-hooks/exhaustive-deps --
         * This 'useEffect' should only run once during mount.
         **/
    }, []);

    const reload = useCallback(() => {
        setIsLoadingAudits(true);
        actions.getAudits().then(() => setIsLoadingAudits(false));
    }, [actions]);

    const renderComplianceReports = () => {
        if (!isLicensed) {
            return <div/>;
        }
        return <ComplianceReports readOnly={isDisabled}/>;
    };

    let content = null;

    if (isLoadingAudits) {
        content = <LoadingScreen/>;
    } else {
        content = (
            <AuditTable
                audits={audits}
                showUserId={true}
                showIp={true}
                showSession={true}
            />
        );
    }

    return (
        <div>
            {renderComplianceReports()}
            <AdminPanel
                id='user_activity_logs'
                className='compliance-panel'
                title={messages.title}
                button={
                    <Button
                        type='button'
                        emphasis='tertiary'
                        onClick={reload}
                    >
                        <ReloadIcon/>
                        <FormattedMessage {...messages.reload}/>
                    </Button>
                }
            >
                <div className='compliance-panel__table'>
                    {content}
                </div>
            </AdminPanel>
        </div>
    );
};

export default memo(Audits);
