// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useCallback, useMemo} from 'react';
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

const TeamSelector = ({
    onChange,
    teamsById,
    testId,
    value: receivedValue,
    legend,
}: Props): JSX.Element => {
    const value = useMemo(() => {
        const team = teamsById[receivedValue];
        return team ? {label: team.display_name, value: team.id} : undefined;
    }, [receivedValue, teamsById]);

    const {locale} = useIntl();

    const handleTeamChange: ComponentProps<typeof DropdownInput>['onChange'] = useCallback((e) => {
        const teamId = e.value;
        onChange(teamId);
    }, [onChange]);

    const teamValues = Object.values(teamsById).
        map((team) => ({value: team.id, label: team.display_name})).
        sort((teamA, teamB) => teamA.label.localeCompare(teamB.label, locale));

    return (
        <DropdownInput
            className='team_selector'
            testId={testId}
            required={true}
            onChange={handleTeamChange}
            value={value}
            options={teamValues}
            name='team_selector'
            legend={legend}
        />
    );
};

export default TeamSelector;
