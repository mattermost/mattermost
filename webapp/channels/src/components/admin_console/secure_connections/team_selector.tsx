// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';

import type {Team} from '@mattermost/types/teams';
import type {IDMappedObjects} from '@mattermost/types/utilities';

import DropdownInput from 'components/dropdown_input';

export type Props = {
    value: string;
    teamsById: IDMappedObjects<Team>;
    onChange: (teamId: string) => void;
    testId: string;
    legend?: string;
}

const TeamSelector = (props: Props): JSX.Element => {
    const value = props.teamsById[props.value];

    const {locale} = useIntl();

    const handleTeamChange: ComponentProps<typeof DropdownInput>['onChange'] = useCallback((e) => {
        const teamId = e.value;
        props.onChange(teamId);
    }, []);

    const teamValues = Object.values(props.teamsById).
        map((team) => ({value: team.id, label: team.display_name})).
        sort((teamA, teamB) => teamA.label.localeCompare(teamB.label, locale));

    return (
        <DropdownInput
            className='team_selector'
            testId={props.testId}
            required={true}
            onChange={handleTeamChange}
            value={value ? {label: value.display_name, value: value.id} : undefined}
            options={teamValues}
            name='team_selector'
            legend={props.legend}
        />
    );
};

export default TeamSelector;
