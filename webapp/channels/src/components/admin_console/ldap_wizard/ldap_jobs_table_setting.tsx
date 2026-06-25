// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useIntl} from 'react-intl';

import type {Job} from '@mattermost/types/jobs';

import JobsTable from 'components/admin_console/jobs';

import LdapSyncJobDetailsModal from './ldap_sync_job_details_modal';
import type {GeneralSettingProps} from './ldap_wizard';

import {descriptorOrStringToString, renderSettingHelpText} from '../schema_admin_settings';

type Props = {
    disabled: boolean;
} & GeneralSettingProps;

const LDAPJobsTableSetting = (props: Props) => {
    const intl = useIntl();
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    if (!props.schema || props.setting.type !== 'jobstable') {
        return null;
    }

    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    return (
        <>
            <JobsTable
                key={props.schema.id + '_jobstable_' + props.setting.key}
                jobType={props.setting.job_type}
                getExtraInfoText={props.setting.render_job}
                disabled={props.disabled}
                createJobButtonText={descriptorOrStringToString(props.setting.label, intl)}
                createJobHelpText={helpText}
                onRowClick={setSelectedJob}
            />
            {selectedJob && (
                <LdapSyncJobDetailsModal
                    job={selectedJob}
                    onExited={() => setSelectedJob(null)}
                />
            )}
        </>
    );
};

export default LDAPJobsTableSetting;
