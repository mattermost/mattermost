// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useState} from 'react';
import DropdownInput, {ValueType} from 'components/dropdown_input';
import {Team} from '@mattermost/types/teams';
import {useIntl} from 'react-intl';

export type Props = {
    teamsById: {[id: string]: Team};
    onChange: (teamId: string) => void;
}

const TeamSelector = (props: Props): JSX.Element => {
    const [value, setValue] = useState<Team>();
    const intl = useIntl();
    const {formatMessage} = intl;

    const handleTeamChange = useCallback((e) => {
        const teamId = e.value as string;

        setValue(props.teamsById[teamId]);
        props.onChange(teamId);
    }, []);

    const [options, setOptions] = useState<ValueType[]>([]);

    useEffect(() => {
        setOptions(Object.values(props.teamsById).map((team) => ({value: team.id, label: team.display_name})));
    }, [props.teamsById]);

    return (
        <DropdownInput
            className='team_selector'
            required={true}
            onChange={handleTeamChange}
            value={value ? {label: value.display_name, value: value.id} : null}
            options={options}
            legend={formatMessage({id: 'sidebar_left.sidebar_channel_modal.select_team_placeholder', defaultMessage: 'Select Team'})}
            placeholder={formatMessage({id: 'sidebar_left.sidebar_channel_modal.select_team_placeholder', defaultMessage: 'Select Team'})}
            name='team_selector'
        />
    );
};

export default TeamSelector;
