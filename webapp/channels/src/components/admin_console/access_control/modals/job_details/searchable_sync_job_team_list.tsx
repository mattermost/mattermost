// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useRef, useEffect} from 'react';
import {FormattedMessage, defineMessages, injectIntl, type WrappedComponentProps} from 'react-intl';

import {Button} from '@mattermost/shared/components/button';
import type {Team} from '@mattermost/types/teams';

import MagnifyingGlassSVG from 'components/common/svg_images_components/magnifying_glass_svg';
import LoadingScreen from 'components/loading_screen';
import QuickInput from 'components/quick_input';

import Constants from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import type {TeamMembersSyncResults} from '../user_sync/user_sync_modal';

export type TeamSyncResults = {
    [teamId: string]: TeamMembersSyncResults;
};

interface Props extends WrappedComponentProps {
    teams: Team[];
    teamsPerPage: number;
    nextPage: (page: number) => void;
    isSearch: boolean;
    search: (term: string) => void;
    onViewDetails?: (teamId: string, teamName: string, results: TeamMembersSyncResults) => void;
    noResultsText: JSX.Element;
    loading?: boolean;
    syncResults: TeamSyncResults;
}

const SearchableSyncJobTeamList = (props: Props) => {
    const [page, setPage] = useState(0);
    const [nextDisabled, setNextDisabled] = useState(false);
    const [teamSearchValue, setTeamSearchValue] = useState('');
    const [isSearch, setIsSearch] = useState(props.isSearch);

    const teamListScroll = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setIsSearch(props.isSearch);
        if (props.isSearch && !isSearch) {
            setPage(0);
        }
    }, [props.isSearch, isSearch]);

    useEffect(() => {
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    const onKeyDown = (e: KeyboardEvent) => {
        const target = e.target as HTMLElement;
        const isEnterKeyPressed = isKeyPressed(e, Constants.KeyCodes.ENTER);
        if (isEnterKeyPressed && (e.shiftKey || e.ctrlKey || e.altKey)) {
            return;
        }
        if (isEnterKeyPressed && target?.classList.contains('more-modal__row')) {
            target.click();
        }
    };

    const handleRowClick = (team: Team) => {
        if (props.onViewDetails && props.syncResults[team.id]) {
            props.onViewDetails(team.id, team.display_name, props.syncResults[team.id]);
        }
    };

    const createTeamRow = (team: Team) => {
        const ariaLabel = team.display_name.toLowerCase();
        const teamSyncData = props.syncResults[team.id];

        const syncChangesDisplay = teamSyncData ? (
            <div className='changes-cell'>
                <span className='changes-summary'>
                    <span className='added'>
                        {'+' + (teamSyncData.MembersAdded?.length || 0)}
                    </span>
                    {' / '}
                    <span className='removed'>
                        {'-' + (teamSyncData.MembersRemoved?.length || 0)}
                    </span>
                </span>
                {teamSyncData.MassRemovalWarning && (
                    <span
                        className='mass-removal-warning'
                        title={props.intl.formatMessage({
                            id: 'admin.jobTable.syncResults.teams.massRemovalWarning',
                            defaultMessage: 'More than 50% of members were removed from this team.',
                        })}
                    >
                        <i className='fa fa-exclamation-triangle'/>
                    </span>
                )}
            </div>
        ) : null;

        return (
            <div
                className='more-modal__row job-sync-row'
                key={team.id}
                id={`TeamRow-${team.name}`}
                data-testid={`TeamRow-${team.name}`}
                aria-label={ariaLabel}
                onClick={() => handleRowClick(team)}
                tabIndex={0}
            >
                <div className='more-modal__details'>
                    <div className='style--none more-modal__name'>
                        <i className='icon icon-account-multiple-outline'/>
                        <span id='teamName'>{team.display_name}</span>
                    </div>
                </div>
                <div className='more-modal__actions'>
                    {syncChangesDisplay}
                </div>
            </div>
        );
    };

    const nextPage = (e: React.MouseEvent) => {
        e.preventDefault();
        setPage(page + 1);
        setNextDisabled(true);
        props.nextPage(page + 1);
        teamListScroll.current?.scrollTo({top: 0});
    };

    const previousPage = (e: React.MouseEvent) => {
        e.preventDefault();
        setPage(page - 1);
        teamListScroll.current?.scrollTo({top: 0});
    };

    const handleChange = (e?: React.FormEvent<HTMLInputElement>) => {
        if (e?.currentTarget) {
            setTeamSearchValue(e.currentTarget.value);
            props.search(e.currentTarget.value);
        }
    };

    const handleClear = () => {
        setTeamSearchValue('');
        props.search('');
    };

    const getEmptyStateMessage = () => {
        return (
            <FormattedMessage
                id='more_channels.noMore'
                tagName='strong'
                defaultMessage='No results for "{text}"'
                values={{text: teamSearchValue}}
            />
        );
    };

    const teams = props.teams;
    let listContent;
    let nextButton;
    let previousButton;

    if (props.loading && teams.length === 0) {
        listContent = <LoadingScreen/>;
    } else if (teams.length === 0) {
        listContent = (
            <div
                className='no-channel-message channel-switcher__suggestion-box'
                aria-label={teamSearchValue.length > 0 ? props.intl.formatMessage(messages.noMore, {text: teamSearchValue}) : props.intl.formatMessage({id: 'widgets.teams_input.empty', defaultMessage: 'No teams found'})}
            >
                <MagnifyingGlassSVG/>
                <h3 className='primary-message'>
                    {getEmptyStateMessage()}
                </h3>
                {props.noResultsText}
            </div>
        );
    } else {
        const pageStart = page * props.teamsPerPage;
        const pageEnd = pageStart + props.teamsPerPage;
        const teamsToDisplay = props.teams.slice(pageStart, pageEnd);
        listContent = teamsToDisplay.map(createTeamRow);

        if (teamsToDisplay.length >= props.teamsPerPage && pageEnd < props.teams.length) {
            nextButton = (
                <Button
                    emphasis='tertiary'
                    size='sm'
                    className='filter-control filter-control__next'
                    onClick={nextPage}
                    disabled={nextDisabled}
                    aria-label={props.intl.formatMessage({id: 'more_channels.next', defaultMessage: 'Next'})}
                >
                    <FormattedMessage
                        id='more_channels.next'
                        defaultMessage='Next'
                    />
                </Button>
            );
        }

        if (page > 0) {
            previousButton = (
                <Button
                    emphasis='tertiary'
                    size='sm'
                    className='filter-control filter-control__prev'
                    onClick={previousPage}
                    aria-label={props.intl.formatMessage({id: 'more_channels.prev', defaultMessage: 'Previous'})}
                >
                    <FormattedMessage
                        id='more_channels.prev'
                        defaultMessage='Previous'
                    />
                </Button>
            );
        }
    }

    const input = (
        <div className='filter-row'>
            <span
                id='searchIcon'
                aria-hidden='true'
            >
                <i className='icon icon-magnify'/>
            </span>
            <QuickInput
                id='searchTeamsTextbox'
                className='form-control filter-textbox'
                placeholder={props.intl.formatMessage({id: 'admin.jobTable.syncResults.teams.search', defaultMessage: 'Search teams'})}
                onInput={handleChange}
                clearable={true}
                onClear={handleClear}
                value={teamSearchValue}
                aria-label={props.intl.formatMessage({id: 'admin.jobTable.syncResults.teams.search', defaultMessage: 'Search teams'})}
            />
        </div>
    );

    let teamCountLabel;
    if (teams.length === 0) {
        teamCountLabel = props.intl.formatMessage({id: 'more_channels.count_zero', defaultMessage: '0 Results'});
    } else if (teams.length === 1) {
        teamCountLabel = props.intl.formatMessage({id: 'more_channels.count_one', defaultMessage: '1 Result'});
    } else {
        teamCountLabel = props.intl.formatMessage(messages.teamCount, {count: teams.length});
    }

    return (
        <div className='filtered-user-list'>
            {input}
            <div className='more-modal__dropdown'>
                <span className='sync-job-channel-count-label'>
                    {teamCountLabel}
                </span>
            </div>
            <div
                role='search'
                className='more-modal__list'
                tabIndex={-1}
            >
                <div
                    id='moreTeamsList'
                    tabIndex={-1}
                    ref={teamListScroll}
                >
                    {listContent}
                </div>
            </div>
            <div className='filter-controls'>
                {previousButton}
                {nextButton}
            </div>
        </div>
    );
};

const messages = defineMessages({
    teamCount: {
        id: 'admin.jobTable.syncResults.teams.count',
        defaultMessage: '{count} Results',
    },
    noMore: {
        id: 'more_channels.noMore',
        defaultMessage: 'No results for "{text}"',
    },
});

export default injectIntl(SearchableSyncJobTeamList);
