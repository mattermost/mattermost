// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useMemo, useState} from 'react';
import {useIntl} from 'react-intl';
import type {GroupBase} from 'react-select';

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

    const anyOption: OptionType = useMemo(() => ({
        value: RoleFilters.Any,
        label: formatMessage({
            id: 'admin.system_users.filters.role.any',
            defaultMessage: 'Any',
        }),
    }), [formatMessage]);

    const roleOptions: OptionType[] = useMemo(() => [
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
    ], [formatMessage]);

    const guestOptions: OptionType[] = useMemo(() => [
        {
            value: RoleFilters.GuestAll,
            label: formatMessage({
                id: 'admin.system_users.filters.role.system_guest',
                defaultMessage: 'Guests (all)',
            }),
        },
        {
            value: RoleFilters.GuestSingleChannel,
            label: formatMessage({
                id: 'admin.system_users.filters.role.guest_single_channel',
                defaultMessage: 'Guests in a single channel',
            }),
        },
        {
            value: RoleFilters.GuestMultiChannel,
            label: formatMessage({
                id: 'admin.system_users.filters.role.guest_multi_channel',
                defaultMessage: 'Guests in multiple channels',
            }),
        },
    ], [formatMessage]);

    const flatOptions = useMemo(() => [anyOption, ...roleOptions, ...guestOptions], [anyOption, roleOptions, guestOptions]);

    const groupedOptions: Array<GroupBase<OptionType>> = useMemo(() => [
        {label: '', options: [anyOption]},
        {label: '', options: roleOptions},
        {label: '', options: guestOptions},
    ], [anyOption, roleOptions, guestOptions]);

    const [value, setValue] = useState(() => getDefaultSelectedValueFromList(props.initialValue, flatOptions));

    function handleChange(value: OptionType) {
        setValue(value);

        props.onChange(value.value);
    }

    return (
        <DropdownInput<OptionType>
            name='filterRole'
            isSearchable={false}
            legend={formatMessage({id: 'admin.system_users.filters.role.title', defaultMessage: 'Role'})}
            options={groupedOptions}
            value={value}
            onChange={handleChange}
        />
    );
}
