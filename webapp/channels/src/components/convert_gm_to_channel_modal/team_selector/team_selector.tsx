// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import DropdownInput from 'components/dropdown_input';
import {Team} from '@mattermost/types/teams';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {getCurrentLocale} from 'selectors/i18n';

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

    const currentLocale = useSelector(getCurrentLocale);

    const teamValues = Object.values(props.teamsById).
        map((team) => ({value: team.id, label: team.display_name})).
        sort((teamA, teamB) => teamA.label.localeCompare(teamB.label, currentLocale));

    return (
        <DropdownInput
            className='team_selector'
            required={true}
            onChange={handleTeamChange}
            value={value ? {label: value.display_name, value: value.id} : undefined}
            options={teamValues}
            legend={formatMessage({id: 'sidebar_left.sidebar_channel_modal.select_team_placeholder', defaultMessage: 'Select Team'})}
            placeholder={formatMessage({id: 'sidebar_left.sidebar_channel_modal.select_team_placeholder', defaultMessage: 'Select Team'})}
            name='team_selector'
        />
    );
};

export default TeamSelector;
