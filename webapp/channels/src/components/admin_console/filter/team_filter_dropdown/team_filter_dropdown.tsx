// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Team, TeamSearchOpts} from '@mattermost/types/teams';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import {debounce} from 'mattermost-redux/actions/helpers';
import {createSelector} from 'mattermost-redux/selectors/create_selector';

import InfiniteScroll from 'components/gif_picker/components/InfiniteScroll';
import LoadingSpinner from 'components/widgets/loading/loading_spinner';

import {FilterOption, FilterValues} from '../filter';
import * as Utils from 'utils/utils';

import TeamFilterCheckbox from './team_filter_checkbox';

import './team_filter_dropdown.scss';
import '../filter.scss';

type Props = {
    option: FilterOption;
    optionKey: string;
    updateValues: (values: FilterValues, optionKey: string) => void;

    teams: Team[];
    total: number;
    actions: {
        getData: (page: number, perPage: number) => Promise<{ data: any }>;
        searchTeams: (term: string, opts: TeamSearchOpts) => Promise<{ data: any }>;
    };
};

type State = {
    page: number;
    loading: boolean;
    show: boolean;
    savedSelectedTeams: Team[];
    searchResults: Team[];
    searchTerm: string;
    searchTotal: number;
}

const getSelectedTeams = createSelector(
    'getSelectedTeams',
    (selectedTeamIds: string[]) => selectedTeamIds,
    (selectedTeamIds: string[], teams: Team[]) => teams,
    (selectedTeamIds, teams) => teams.filter((team) => selectedTeamIds.includes(team.id)),
);

const getFilteredTeams = createSelector(
    'getFilteredTeams',
    (term: string) => term.trim().toLowerCase(),
    (term: string, teams: Team[]) => teams,
    (term: string, teams: Team[]) => {
        return teams.filter((team: Team) => team?.display_name?.toLowerCase().includes(term));
    },
);

const TEAMS_PER_PAGE = 50;
const MAX_BUTTON_TEXT_LENGTH = 30;
const INITIAL_SEARCH_RETRY_TIMEOUT = 300;
class TeamFilterDropdown extends React.PureComponent<Props, State> {
    private ref: React.RefObject<HTMLDivElement>;
    private searchRef: React.RefObject<HTMLInputElement>;
    private clearRef: React.RefObject<HTMLInputElement>;
    private listRef: React.RefObject<HTMLDivElement>;
    private searchRetryInterval: number;
    private searchRetryId: number;
    private scrollPosition: number;

    public constructor(props: Props) {
        super(props);

        this.state = {
            page: 0,
            loading: false,
            show: false,
            savedSelectedTeams: [],
            searchResults: [],
            searchTerm: '',
            searchTotal: 0,
        };

        this.ref = React.createRef();
        this.searchRef = React.createRef();
        this.clearRef = React.createRef();
        this.listRef = React.createRef();
        this.searchRetryInterval = INITIAL_SEARCH_RETRY_TIMEOUT;
        this.searchRetryId = 0;
        this.scrollPosition = 0;
    }

    componentDidMount() {
        document.addEventListener('mousedown', this.handleClickOutside);
        this.props.actions.getData(0, TEAMS_PER_PAGE);
    }

    componentWillUnmount = () => {
        document.removeEventListener('mousedown', this.handleClickOutside);
    };

    hidePopover = () => {
        this.setState({show: false});
    };

    togglePopover = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        if (this.state.show) {
            this.hidePopover();
            return;
        }

        if (this.clearRef?.current?.contains(event.target as Node)) {
            return;
        }

        const selectedTeamIds = this.props.option.values.team_ids.value as string[];
        const selectedTeams = getSelectedTeams(selectedTeamIds, this.props.teams);
        const savedSelectedTeams = selectedTeams.sort((a, b) => a.display_name.localeCompare(b.display_name));
        this.setState({show: true, savedSelectedTeams, searchTerm: ''}, () => {
            this.searchRef?.current?.focus();
            if (this.listRef?.current) {
                this.listRef.current.scrollTop = 0;
            }
        });
    };

    handleClickOutside = (event: MouseEvent) => {
        if (this.ref?.current?.contains(event.target as Node)) {
            return;
        }
        this.hidePopover();
    };

    setScrollPosition = (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
        this.scrollPosition = (event.target as HTMLDivElement).scrollTop;
    };

    hasMore = (): boolean => {
        if (this.state.loading) {
            return false;
        } else if (this.state.searchTerm.length > 0) {
            return this.state.searchTotal > this.state.searchResults.length;
        }
        return this.props.total > (this.state.page + 1) * TEAMS_PER_PAGE;
    };

    loadMore = async () => {
        const {searchTerm, loading} = this.state;
        if (loading) {
            return;
        }
        this.setState({loading: true});
        const page = this.state.page + 1;
        if (searchTerm.length > 0) {
            this.searchTeams(searchTerm, page);
        } else {
            await this.props.actions.getData(page, TEAMS_PER_PAGE);
        }

        if (this.listRef?.current) {
            this.listRef.current.scrollTop = this.scrollPosition;
        }

        this.setState({page, loading: false});
    };

    searchTeams = async (term: string, page: number) => {
        let searchResults = [];
        let searchTotal = 0;
        const response = await this.props.actions.searchTeams(term, {page, per_page: TEAMS_PER_PAGE});
        if (response?.data) {
            const {data} = response;
            searchResults = page > 0 ? this.state.searchResults.concat(data.teams) : data.teams;
            searchTotal = data.total_count;
            this.setState({page, loading: false, searchResults, searchTotal, searchTerm: term});
            return;
        }
        this.searchRetryInterval *= 2;
        this.searchRetryId = window.setTimeout(this.searchTeams.bind(null, term, page), this.searchRetryInterval);
    };

    searchTeamsDebounced = debounce((page, term) => this.searchTeams(term, page), INITIAL_SEARCH_RETRY_TIMEOUT, false, () => {});

    handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const searchTerm = e.target.value;

        if (this.searchRetryId !== 0) {
            clearTimeout(this.searchRetryId);
            this.searchRetryId = 0;
            this.searchRetryInterval = INITIAL_SEARCH_RETRY_TIMEOUT;
        }

        if (searchTerm.length === 0) {
            const selectedTeamIds = this.props.option.values.team_ids.value as string[];
            const selectedTeams = getSelectedTeams(selectedTeamIds, this.props.teams);
            const savedSelectedTeams = selectedTeams.sort((a, b) => a.display_name.localeCompare(b.display_name));
            this.setState({searchTerm, savedSelectedTeams, searchResults: [], searchTotal: 0, page: 0});
        } else {
            this.setState({loading: true, searchTerm, searchResults: [], searchTotal: 0, page: 0});
        }

        this.searchTeamsDebounced(0, searchTerm);
    };

    resetTeams = () => {
        this.setState({savedSelectedTeams: [], show: false, searchResults: [], searchTotal: 0, page: 0, searchTerm: ''});
        this.props.updateValues({team_ids: {name: 'Teams', value: []}}, 'teams');
    };

    toggleTeam = (checked: boolean, teamId: string) => {
        const prevSelectedTeamIds = this.props.option.values.team_ids.value as string[];
        let selectedTeamIds;
        if (checked) {
            selectedTeamIds = [...prevSelectedTeamIds, teamId];
        } else {
            selectedTeamIds = prevSelectedTeamIds.filter((id) => id !== teamId);
        }

        this.props.updateValues({team_ids: {name: 'Teams', value: selectedTeamIds}}, 'teams');
    };

    generateButtonText = () => {
        const selectedTeamIds = this.props.option.values.team_ids.value as string[];
        if (selectedTeamIds.length === 0) {
            return {
                buttonText: (
                    <FormattedMessage
                        id='admin.filter.all_teams'
                        defaultMessage='All Teams'
                    />
                ),
                buttonMore: 0,
            };
        }

        const selectedTeams = getSelectedTeams(selectedTeamIds, this.props.teams);
        let buttonText = '';
        let buttonMore = 0;
        let buttonOverflowed = false;
        selectedTeams.forEach((team, index) => {
            buttonOverflowed = buttonOverflowed || !(MAX_BUTTON_TEXT_LENGTH > (buttonText.length + team.display_name.length));
            if (index === 0) {
                buttonText += team.display_name;
            } else if (buttonOverflowed) {
                buttonMore += 1;
            } else {
                buttonText = `${buttonText}, ${team.display_name}`;
            }
        });

        return {buttonText, buttonMore};
    };

    render() {
        const selectedTeamIds = this.props.option.values.team_ids.value as string[];
        const {buttonText, buttonMore} = this.generateButtonText();

        const createFilterCheckbox = (team: Team) => {
            return (
                <TeamFilterCheckbox
                    id={team.id}
                    name={team.id}
                    checked={selectedTeamIds.includes(team.id)}
                    updateOption={this.toggleTeam}
                    label={team.display_name}
                    key={team.id}
                />
            );
        };

        let visibleTeams = this.state.searchResults;
        let selectedTeams: JSX.Element[] = [];
        if (this.state.searchTerm.length === 0) {
            visibleTeams = this.props.teams.slice(0, (this.state.page + 1) * TEAMS_PER_PAGE).filter((team) => !this.state.savedSelectedTeams.some((selectedTeam) => selectedTeam.id === team.id));
            selectedTeams = this.state.savedSelectedTeams.map(createFilterCheckbox);
        } else {
            visibleTeams = getFilteredTeams(this.state.searchTerm, visibleTeams);
        }
        const teamsToDisplay = visibleTeams.map(createFilterCheckbox);
        const chevron = this.state.show ? (<i className='Icon icon-chevron-up'/>) : (<i className='Icon icon-chevron-down'/>);

        return (
            <div
                className='FilterList FilterList__full'
            >
                <div className='FilterList_name'>
                    {this.props.option.name}
                </div>

                <div
                    className='TeamFilterDropdown'
                    ref={this.ref}
                >
                    <button
                        type='button'
                        className='TeamFilterDropdownButton'
                        onClick={this.togglePopover}
                    >
                        <div className='TeamFilterDropdownButton_text'>
                            {buttonText}
                        </div>

                        {buttonMore > 0 && (
                            <div className='TeamFilterDropdownButton_more'>
                                <FormattedMessage
                                    id='admin.filter.count_more'
                                    defaultMessage='+{count, number} more'
                                    values={{count: buttonMore}}
                                />
                            </div>
                        )}

                        {selectedTeamIds.length > 0 && (
                            <i
                                className={'TeamFilterDropdownButton_clear fa fa-times-circle'}
                                onClick={this.resetTeams}
                                ref={this.clearRef}
                            />
                        )}

                        <div className='TeamFilterDropdownButton_icon'>
                            {chevron}
                        </div>
                    </button>

                    <div className={this.state.show ? 'TeamFilterDropdownOptions TeamFilterDropdownOptions__active' : 'TeamFilterDropdownOptions'}>
                        <input
                            className='TeamFilterDropdown_search'
                            type='text'
                            placeholder={Utils.localizeMessage('search_bar.search', 'Search')}
                            value={this.state.searchTerm}
                            onChange={this.handleSearch}
                            ref={this.searchRef}
                        />

                        {selectedTeamIds.length > 0 && (
                            <a
                                className='TeamFilterDropdown_reset'
                                onClick={this.resetTeams}
                            >
                                <FormattedMessage
                                    id='admin.filter.reset_teams'
                                    defaultMessage='Reset to all teams'
                                />
                            </a>
                        )}

                        {selectedTeamIds.length === 0 && (
                            <div
                                className='TeamFilterDropdown_allTeams'
                            >
                                <FormattedMessage
                                    id='admin.filter.showing_all_teams'
                                    defaultMessage='Showing all teams'
                                />
                            </div>
                        )}

                        <div
                            className='TeamFilterDropdownOptions_list'
                            ref={this.listRef}
                            onScroll={this.setScrollPosition}
                        >
                            {selectedTeams}

                            {selectedTeams.length > 0 && <div className='TeamFilterDropdown_divider'/>}

                            <InfiniteScroll
                                hasMore={this.hasMore()}
                                loadMore={this.loadMore}
                                threshold={50}
                                useWindow={false}
                                initialLoad={false}
                            >
                                {teamsToDisplay}
                            </InfiniteScroll>

                            {this.state.loading && (
                                <div className='TeamFilterDropdown_loading'>
                                    <LoadingSpinner/>
                                    <FormattedMessage
                                        id='admin.data_grid.loading'
                                        defaultMessage='Loading'
                                    />
                                </div>
                            )}

                            {teamsToDisplay.length === 0 && selectedTeams.length === 0 && !this.state.loading && (
                                <div className='TeamFilterDropdown_empty'>
                                    <FormattedMessage
                                        id='admin.filter.no_results'
                                        defaultMessage='No items match'
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default TeamFilterDropdown;
