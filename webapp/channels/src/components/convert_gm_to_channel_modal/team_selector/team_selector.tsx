// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from "react";
import DropdownInput from "components/dropdown_input";
import {Team} from "@mattermost/types/teams";
import {useIntl} from "react-intl";

export type Props = {
    teamsById: {[id: string]: Team}
    onChange: (selectedTeam: Team) => void
}

const TeamSelector = (props: Props): JSX.Element => {
    const [value, setValue] = useState<Team>();
    const intl = useIntl();
    const {formatMessage} = intl;

    const handleTeamChange = useCallback((e) => {
        console.log('handleTeamChange');
        const team = e.value as Team

        setValue(team);
        props.onChange(team);
    }, [])

    return (
        <DropdownInput
            className='team_selector'
            onChange={handleTeamChange}
            value={value ? {label: value.display_name, value: value.id} : null}
            options={props.teamsById.map((team) => ({label: team.display_name, value: team.id}))}
            legend={formatMessage({id: 'sidebar_left.sidebar_channel_modal.select_team_placeholder', defaultMessage: 'Select Team'})}
            placeholder={formatMessage({id: 'sidebar_left.sidebar_channel_modal.select_team_placeholder', defaultMessage: 'Select Team'})}
            name='team_selector'
        />
    )
}

export default TeamSelector;