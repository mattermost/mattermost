// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {CheckIcon, ChevronDownIcon, MagnifyIcon as SearchIcon} from '@mattermost/compass-icons/components';

import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId, getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getCurrentLocale} from 'selectors/i18n';

import * as Menu from 'components/menu';

import {Preferences} from 'utils/constants';
import {filterAndSortTeamsByDisplayName} from 'utils/team_utils';

import type {GlobalState} from 'types/store';
import './select_team.scss';

interface Props {
    selectedTeamId: string;
    onTeamSelected: (team: string) => void;
}

const SelectTeam = (props: Props) => {
    const intl = useIntl();
    const myTeams = useSelector(getMyTeams);
    const locale = useSelector(getCurrentLocale);
    const userTeamsOrderPreference = useSelector((state: GlobalState) => get(state, Preferences.TEAMS_ORDER, '', ''));
    const currentTeamId = useSelector(getCurrentTeamId);
    const [filter, setFilter] = React.useState('');

    const currentlySelectedTeam = myTeams.find((t) => t.id === props.selectedTeamId);
    const isDifferentTeamSelected = props.selectedTeamId !== currentTeamId;

    const allTeamsText = intl.formatMessage({
        id: 'search_teams_selector.all_teams',
        defaultMessage: 'All Teams',
    });

    let menuButtonText = allTeamsText;
    if (props.selectedTeamId) {
        const team = myTeams.find((t) => t.id === props.selectedTeamId);
        if (team) {
            menuButtonText = team.display_name;
        }
    }

    const button = (
        <><span>{menuButtonText}</span> <ChevronDownIcon size={12}/></>
    );

    const onFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFilter(e.target.value);
    };

    const handleTeamChange = (teamId: string) => {
        props.onTeamSelected(teamId);
        setFilter('');
    };

    // we only show the filter input and separator if there's more than 4 teams
    const showFilter = myTeams.length > 4;

    const teams = React.useMemo(() => {
        // if we show the filter, exclude the current team from the list
        const myTeamsList = showFilter ? myTeams.filter((team) => team.id !== props.selectedTeamId) : myTeams;

        let filteredTeams = filterAndSortTeamsByDisplayName(myTeamsList, locale, userTeamsOrderPreference);
        if (filter) {
            filteredTeams = filteredTeams.filter((team) => team.display_name.toLowerCase().includes(filter.toLowerCase()));
        }
        return filteredTeams;
    }, [myTeams, locale, userTeamsOrderPreference, filter, showFilter, props.selectedTeamId]);

    const renderTeam = (teamId: string, teamName: string, elementId: string, className: string = '') => {
        return (
            <Menu.Item
                id={elementId}
                role='menuitemradio'
                forceCloseOnSelect={true}
                aria-checked={teamId === props.selectedTeamId}
                key={'team-' + teamId}
                onClick={() => handleTeamChange(teamId)}
                labels={<span>{teamName}</span>}
                trailingElements={(teamId === props.selectedTeamId && (
                    <CheckIcon
                        size={16}
                        color='var(--button-bg, #1c58d9)'
                    />
                ))}
                className={className}
            />
        );
    };

    // MUI Menu doesn't support fragments, and the recommended alternative is to use an array.
    const renderFilterArea = () => {
        const elements = [
            <Menu.InputItem
                key='filter_teams'
                id='search_teams'
                type='text'
                placeholder={intl.formatMessage({id: 'search_teams_selector.search_teams', defaultMessage: 'Search teams'})}
                className='search-teams-selector-search'
                inputPrefix={<SearchIcon size={18}/>}
                value={filter}
                onChange={onFilterChange}
            />,
        ];
        if (currentlySelectedTeam) {
            elements.push(
                renderTeam(currentlySelectedTeam.id, currentlySelectedTeam.display_name, currentlySelectedTeam.id, 'search-teams-selector-current-team'),
                <Menu.Title
                    key='your-team-title'
                    role='separator'
                >
                    <FormattedMessage
                        id='search_teams_selector.your_teams'
                        defaultMessage='Your teams'
                    />
                </Menu.Title>,
            );
        }
        return elements;
    };

    return (
        <Menu.Container
            menuButton={{
                id: 'searchTeamsSelectorMenuButton',
                class: classNames('search-teams-selector-menu-button', {'search-teams-selector-menu-button__different-team': isDifferentTeamSelected}),
                children: button,
                dataTestId: 'searchTeamsSelectorMenuButton',
            }}
            menu={{
                id: 'searchTeamSelectorMenu',
                'aria-label': 'Select team',
                className: 'select-team-mui-menu',
            }}
            anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
            transformOrigin={{vertical: 'top', horizontal: 'right'}}
        >
            {renderTeam('', allTeamsText, 'all_teams')}
            <Menu.Separator/>
            {showFilter && renderFilterArea()}
            {teams.map((team) => renderTeam(team.id, team.display_name, team.id))}
        </Menu.Container>
    );
};

export default SelectTeam;
