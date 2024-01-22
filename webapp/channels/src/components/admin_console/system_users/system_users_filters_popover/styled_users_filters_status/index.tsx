// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import {setAdminConsoleUsersManagementTableProperties} from 'actions/views/admin';

import DropdownInput from 'components/dropdown_input';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {StatusFilter} from '../../constants';

type OptionType = {
    label: string;
    value: StatusFilter;
}

interface Props {
    value: AdminConsoleUserManagementTableProperties['filterStatus'];
}

export function SystemUsersFiltersStatus(props: Props) {
    const {formatMessage} = useIntl();

    const dispatch = useDispatch();

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
                    defaultMessage: 'Active users',
                }),
            },
            {
                value: StatusFilter.Deactivated,
                label: formatMessage({
                    id: 'admin.system_users.filters.status.deactive',
                    defaultMessage: 'Deactived users',
                }),
            },
        ];
    }, []);

    function getInitialValue(value: Props['value']) {
        const option = options.find((option) => option.value === value);

        if (option) {
            return option;
        }

        return options[0];
    }

    const [value, setValue] = useState(getInitialValue(props.value));

    function handleChange(value: OptionType) {
        setValue(value);

        let filterStatus = '';
        if (value.value === StatusFilter.Active) {
            filterStatus = 'active';
        } else if (value.value === StatusFilter.Deactivated) {
            filterStatus = 'deactivated';
        }

        dispatch(setAdminConsoleUsersManagementTableProperties({filterStatus}));
    }

    return (
        <DropdownInput<OptionType>
            name='filterStatus'
            showLegend={true}
            legend={formatMessage({id: 'admin.system_users.filters.status.title', defaultMessage: 'Status'})}
            options={options}
            value={value}
            onChange={handleChange}
        />
    );
}
