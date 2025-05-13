// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import JobsTable from 'components/admin_console/jobs';

import type {GeneralSettingProps} from './ldap_wizard';

import {descriptorOrStringToString, renderSettingHelpText} from '../schema_admin_settings';

type Props = {
    disabled: boolean;
} & GeneralSettingProps

const LDAPJobsTableSetting = (props: Props) => {
    if (!props.schema || props.setting.type !== 'jobstable') {
        return (<></>);
    }

    const helpText = renderSettingHelpText(props.setting, props.schema, Boolean(props.disabled));

    return (
        <JobsTable
            key={props.schema.id + '_jobstable_' + props.setting.key}
            jobType={props.setting.job_type}
            getExtraInfoText={props.setting.render_job}
            disabled={props.disabled}
            createJobButtonText={descriptorOrStringToString(props.setting.label, props.intl)}
            createJobHelpText={helpText}
        />
    );
};

export default LDAPJobsTableSetting;
