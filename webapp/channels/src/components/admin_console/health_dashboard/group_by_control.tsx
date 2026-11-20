// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useId} from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

export type GroupBy = 'severity' | 'category';

const options: GroupBy[] = ['severity', 'category'];

const optionMessages = defineMessages<GroupBy>({
    severity: {id: 'admin.health_dashboard.group_by.severity', defaultMessage: 'Severity'},
    category: {id: 'admin.health_dashboard.group_by.category', defaultMessage: 'Category'},
});

type Props = {
    value: GroupBy;
    onChange: (value: GroupBy) => void;
};

const GroupByControl = ({value, onChange}: Props) => {
    const labelId = useId();

    return (
        <div className='HealthDashboard__groupBy'>
            <span
                id={labelId}
                className='HealthDashboard__groupByLabel'
            >
                <FormattedMessage
                    id='admin.health_dashboard.group_by.label'
                    defaultMessage='Group by'
                />
            </span>
            <div
                role='group'
                aria-labelledby={labelId}
                className='HealthDashboard__segmented'
            >
                {options.map((option) => (
                    <button
                        key={option}
                        type='button'
                        aria-pressed={option === value}
                        className={classNames('HealthDashboard__segment', {'HealthDashboard__segment--active': option === value})}
                        onClick={() => onChange(option)}
                    >
                        <FormattedMessage {...optionMessages[option]}/>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default GroupByControl;
