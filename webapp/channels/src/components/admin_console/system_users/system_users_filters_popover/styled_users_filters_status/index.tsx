// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import DropdownInput from 'components/dropdown_input';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {StatusFilter} from '../../constants';
import {getDefaultSelectedValueFromList} from '../../utils';

type OptionType = {
    label: string;
    value: StatusFilter;
}

interface Props {
    initialValue: AdminConsoleUserManagementTableProperties['filterStatus'];
    onChange: (value: AdminConsoleUserManagementTableProperties['filterStatus']) => void;
}

export function SystemUsersFiltersStatus(props: Props) {
    const {formatMessage} = useIntl();

    const options = useMemo(() => {
        return [
            {
                value: StatusFilter.Any,
                label: formatMessage({
                    id: 'admin.system_users.filters.status.any',
                    defaultMessage: 'Any',
                }),
            },
            {
                value: StatusFilter.Active,
                label: formatMessage({
                    id: 'admin.system_users.filters.status.active',
                    defaultMessage: 'Activated users',
                }),
            },
            {
                value: StatusFilter.Deactivated,
                label: formatMessage({
                    id: 'admin.system_users.filters.status.deactive',
                    defaultMessage: 'Deactivated users',
                }),
            },
        ];
    }, []);

    const [value, setValue] = useState(() => getDefaultSelectedValueFromList(props.initialValue, options));

    function handleChange(value: OptionType) {
        setValue(value);

        props.onChange(value.value);
    }

    return (
        <DropdownInput<OptionType>
            name='filterStatus'
            showLegend={true}
            isSearchable={false}
            legend={formatMessage({id: 'admin.system_users.filters.status.title', defaultMessage: 'Status'})}
            options={options}
            value={value}
            onChange={handleChange}
        />
    );
}
