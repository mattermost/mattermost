// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import * as Menu from 'components/menu';
import './select_team.scss';

interface Props {
    value: string;
    onChange: (team: string) => void;
}

const SelectTeam = (props: Props) => {
    const intl = useIntl();
    const teams = useSelector(getMyTeams);
    const currentTeamId = useSelector(getCurrentTeamId);
    teams.sort((a, b) => a.display_name.localeCompare(b.display_name));

    const isDifferentTeamSelected = props.value !== currentTeamId;

    const allTeamsText = intl.formatMessage({
        id: 'search_teams_selector.all_teams',
        defaultMessage: 'All Teams',
    });

    let menuButtonText = allTeamsText;
    if (props.value) {
        const team = teams.find((t) => t.id === props.value);
        if (team) {
            menuButtonText = team.display_name;
        }
    }

    const button = (
        <span>{menuButtonText}  <i className='icon icon-chevron-down'/></span>
    );

    return (
        <Menu.Container
            menuButton={{
                id: 'searchTeamsSelectorMenuButton',
                class: classNames('search-teams-selector-menu-button', {'search-teams-selector-menu-button__different-team': isDifferentTeamSelected}),
                children: button,
                as: 'span',
            }}
            menu={{
                id: 'searchTeamSelectorMenu',
            }}
        >
            <Menu.Item
                id='all_teams'
                onClick={() => {
                    props.onChange('');
                }}
                labels={<span>{allTeamsText}</span>}
                trailingElements={(props.value === '' && <div><i className='icon icon-check'/></div>)}
            />
            <Menu.Separator/>
            {teams.map((team) => (
                <Menu.Item
                    id={team.id}
                    key={team.id}
                    onClick={() => props.onChange(team.id)}
                    labels={<span>{team.display_name}</span>}
                    trailingElements={(team.id === props.value && <div><i className='icon icon-check'/></div>)}
                />
            ))}
        </Menu.Container>
    );
};

export default SelectTeam;
