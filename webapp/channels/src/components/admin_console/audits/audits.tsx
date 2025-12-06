// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, memo, useCallback} from 'react';
import type {CSSProperties} from 'react';
import {FormattedMessage, defineMessages} from 'react-intl';

import type {Audit} from '@mattermost/types/audits';

import type {ActionResult} from 'mattermost-redux/types/actions';

import ComplianceReports from 'components/admin_console/compliance_reports';
import AuditTable from 'components/audit_table';
import LoadingScreen from 'components/loading_screen';
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
    reload: {id: 'admin.audits.reload', defaultMessage: 'Reload User Activity Logs'},
});

export const searchableStrings = [
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

    const activityLogHeader = () => {
        const h4Style: CSSProperties = {
            display: 'inline-block',
            marginBottom: '6px',
        };
        const divStyle: CSSProperties = {
            clear: 'both',
        };
        return (
            <div style={divStyle}>
                <h4 style={h4Style}>
                    <FormattedMessage
                        id='admin.complianceMonitoring.userActivityLogsTitle'
                        defaultMessage='User Activity Logs'
                    />
                </h4>
                <button
                    type='submit'
                    className='btn btn-tertiary pull-right'
                    onClick={reload}
                >
                    <ReloadIcon/>
                    <FormattedMessage {...messages.reload}/>
                </button>
            </div>
        );
    };

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
            <div>
                <AuditTable
                    audits={audits}
                    showUserId={true}
                    showIp={true}
                    showSession={true}
                />
            </div>
        );
    }

    return (
        <div>
            {renderComplianceReports()}
            <div className='panel compliance-panel'>
                {activityLogHeader()}
                <div className='compliance-panel__table'>
                    {content}
                </div>
            </div>
        </div>
    );
};

export default memo(Audits);
