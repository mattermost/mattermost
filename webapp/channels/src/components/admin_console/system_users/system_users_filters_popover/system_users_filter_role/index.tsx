// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';

import DropdownInput from 'components/dropdown_input';

import type {AdminConsoleUserManagementTableProperties} from 'types/store/views';

import {RoleFilters} from '../../constants';
import {getDefaultSelectedValueFromList} from '../../utils';

type OptionType = {
    label: string;
    value: RoleFilters;
}

type Props = {
    initialValue: AdminConsoleUserManagementTableProperties['filterRole'];
    onChange: (value: AdminConsoleUserManagementTableProperties['filterRole']) => void;
};

export function SystemUsersFilterRole(props: Props) {
    const {formatMessage} = useIntl();

    const options = useMemo(() => {
        return [
            {
                value: RoleFilters.Any,
                label: formatMessage({
                    id: 'admin.system_users.filters.role.any',
                    defaultMessage: 'Any',
                }),
            },
            {
                value: RoleFilters.Admin,
                label: formatMessage({
                    id: 'admin.system_users.filters.role.system_admin',
                    defaultMessage: 'System Admin',
                }),
            },
            {
                value: RoleFilters.Member,
                label: formatMessage({
                    id: 'admin.system_users.filters.role.system_user',
                    defaultMessage: 'Member',
                }),
            },
            {
                value: RoleFilters.Guest,
                label: formatMessage({
                    id: 'admin.system_users.filters.role.system_guest',
                    defaultMessage: 'Guest',
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
            name='filterRole'
            showLegend={true}
            isSearchable={false}
            legend={formatMessage({id: 'admin.system_users.filters.role.title', defaultMessage: 'Role'})}
            options={options}
            value={value}
            onChange={handleChange}
        />
    );
}
