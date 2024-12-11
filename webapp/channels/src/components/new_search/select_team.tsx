// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {CheckIcon, ChevronDownIcon} from '@mattermost/compass-icons/components';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentLocale} from 'selectors/i18n';

import * as Menu from 'components/menu';

import './select_team.scss';
import {Preferences} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import type {GlobalState} from 'types/store';

interface Props {
    value: string;
    onChange: (team: string) => void;
}

const SelectTeam = (props: Props) => {
    const intl = useIntl();
    const myTeams = useSelector(getMyTeams);
    const locale = useSelector(getCurrentLocale);
    const userTeamsOrderPreference = useSelector((state: GlobalState) => get(state, Preferences.TEAMS_ORDER, '', ''));
    const currentTeamId = useSelector(getCurrentTeamId);
    const teams = filterAndSortTeamsByDisplayName(myTeams, locale, userTeamsOrderPreference);

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
        <><span>{menuButtonText}</span> <ChevronDownIcon size={12}/></>
    );

    return (
        <Menu.Container
            menuButton={{
                id: 'searchTeamsSelectorMenuButton',
                class: classNames('search-teams-selector-menu-button', {'search-teams-selector-menu-button__different-team': isDifferentTeamSelected}),
                children: button,
            }}
            menu={{
                id: 'searchTeamSelectorMenu',
            }}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            <Menu.Item
                id='all_teams'
                role='menuitem'
                aria-checked={props.value === ''}
                onClick={() => props.onChange('')}
                labels={<span>{allTeamsText}</span>}
                trailingElements={(props.value === '' && (
                    <CheckIcon
                        size={14}
                        color='var(--button-bg, #1c58d9)'
                    />
                ))}
            />
            <Menu.Separator/>
            {teams.map((team) => (
                <Menu.Item
                    id={team.id}
                    role='menuitem'
                    aria-checked={team.id === props.value}
                    key={team.id}
                    onClick={() => props.onChange(team.id)}
                    labels={<span>{team.display_name}</span>}
                    trailingElements={(team.id === props.value && (
                        <CheckIcon
                            size={14}
                            color='var(--button-bg, #1c58d9)'
                        />
                    ))}
                />
            ))}
        </Menu.Container>
    );
};

export default SelectTeam;
