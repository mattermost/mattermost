// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ChangeEvent} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';

type Props = {
    options?: Team[];
    value?: string;
    onChange: ({searchTerm, teamId, filter}: {searchTerm?: string; teamId?: string; filter?: string}) => void;
    onFilter: ({teamId, filter}: {teamId?: string; filter?: string}) => Promise<void>;
};

// Repurpose for the new filter

export function SystemUsersFilterTeam(props: Props) {
    const {formatMessage} = useIntl();

    function handleChange(e: ChangeEvent<HTMLSelectElement>) {
        const teamId = e?.target?.value ?? '';
        props.onChange({teamId});
        props.onFilter({teamId});
    }

    return (
        <label>
            <span className='system-users__team-filter-label'>
                <FormattedMessage
                    id='filtered_user_list.team'
                    defaultMessage='Team:'
                />
            </span>
            <select
                className='form-control system-users__team-filter'
                value={props.value}
                onChange={handleChange}
            >
                <option>
                    {formatMessage({
                        id: 'admin.system_users.allUsers',
                        defaultMessage: 'All Users',
                    })}
                </option>
                <option>
                    {formatMessage({
                        id: 'admin.system_users.noTeams',
                        defaultMessage: 'No Teams',
                    })}
                </option>
                {props.options?.map((team) => (
                    <option
                        key={team.id}
                        value={team.id}
                    >
                        {team.display_name}
                    </option>
                ))}
            </select>
        </label>
    );
}
