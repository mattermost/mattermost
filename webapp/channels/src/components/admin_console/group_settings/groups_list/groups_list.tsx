// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import type {GroupSearchOpts, MixedUnlinkedGroupRedux} from '@mattermost/types/groups';

import GroupRow from 'components/admin_console/group_settings/group_row';
import CheckboxCheckedIcon from 'components/widgets/icons/checkbox_checked_icon';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';
import SearchIcon from 'components/widgets/icons/search_icon';

import {Constants} from 'utils/constants';
import * as Utils from 'utils/utils';

const LDAP_GROUPS_PAGE_SIZE = 200;

type Props = {
    groups: MixedUnlinkedGroupRedux[];
    total: number;
    readOnly?: boolean;
    actions: {
        getLdapGroups: (page?: number, perPage?: number, opts?: GroupSearchOpts) => Promise<any>;
        link: (key: string) => Promise<any>;
        unlink: (key: string) => Promise<any>;
    };
}

type FilterOption = {
    is_configured?: boolean;
    is_linked?: boolean;
}

type FilterConfig = {
    filter: string;
    option: FilterOption;
}

type FilterSearchMap = {
    filterIsConfigured: FilterConfig;
    filterIsUnconfigured: FilterConfig;
    filterIsLinked: FilterConfig;
    filterIsUnlinked: FilterConfig;
}

type State = {
    checked?: any;
    loading: boolean;
    fetchError: boolean;
    page: number;
    showFilters: boolean;
    searchString: string;
    filterIsConfigured?: boolean;
    filterIsUnconfigured?: boolean;
    filterIsLinked?: boolean;
    filterIsUnlinked?: boolean;
}

type FilterUpdates = [string, boolean];

const FILTER_STATE_SEARCH_KEY_MAPPING: FilterSearchMap = {
    filterIsConfigured: {filter: 'is:configured', option: {is_configured: true}},
    filterIsUnconfigured: {filter: 'is:notconfigured', option: {is_configured: false}},
    filterIsLinked: {filter: 'is:linked', option: {is_linked: true}},
    filterIsUnlinked: {filter: 'is:notlinked', option: {is_linked: false}},
};

export default class GroupsList extends React.PureComponent<Props, State> {
    public static defaultProps: Partial<Props> = {
        groups: [],
    };

    constructor(props: Props) {
        super(props);
        this.state = {
            checked: {},
            fetchError: false,
            loading: true,
            page: 0,
            showFilters: false,
            searchString: '',
            filterIsConfigured: false,
            filterIsUnconfigured: false,
            filterIsLinked: false,
            filterIsUnlinked: false,
        };
    }

    public closeFilters = () => {
        this.setState({showFilters: false});
    };

    public componentDidMount() {
        this.props.actions.getLdapGroups(this.state.page, LDAP_GROUPS_PAGE_SIZE).then(this.handleGetGroupsResponse);
    }

    public async previousPage(e: any): Promise<void> {
        e.preventDefault();
        const page = this.state.page < 1 ? 0 : this.state.page - 1;
        this.setState({checked: {}, page, loading: true}, () => {
            this.searchGroups(page);
        });
    }

    public async nextPage(e: any): Promise<void> {
        e.preventDefault();
        const page = this.state.page + 1;
        this.setState({checked: {}, page, loading: true}, () => {
            this.searchGroups(page);
        });
    }

    public onCheckToggle(key: string) {
        const newChecked = {...this.state.checked};
        newChecked[key] = !newChecked[key];
        this.setState({checked: newChecked});
    }

    public linkSelectedGroups() {
        for (const group of this.props.groups) {
            if (this.state.checked[group.primary_key] && !group.mattermost_group_id) {
                this.props.actions.link(group.primary_key);
            }
        }
    }

    public unlinkSelectedGroups() {
        for (const group of this.props.groups) {
            if (this.state.checked[group.primary_key] && group.mattermost_group_id) {
                this.props.actions.unlink(group.primary_key);
            }
        }
    }

    public selectionActionButtonType(): string {
        let hasSelectedLinked = false;
        for (const group of this.props.groups) {
            if (this.state.checked[group.primary_key]) {
                if (!group.mattermost_group_id) {
                    return 'link';
                }
                hasSelectedLinked = true;
            }
        }
        if (hasSelectedLinked) {
            return 'unlink';
        }

        return 'disabled';
    }

    public renderSelectionActionButton(): JSX.Element {
        switch (this.selectionActionButtonType()) {
        case 'link':
            return (
                <button
                    type='button'
                    className='btn btn-primary'
                    onClick={() => this.linkSelectedGroups()}
                    disabled={this.props.readOnly}
                >
                    <i className='icon fa fa-link'/>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.link_selected'
                        defaultMessage='Link Selected Groups'
                    />
                </button>
            );
        case 'unlink':
            return (
                <button
                    type='button'
                    className='btn btn-primary'
                    onClick={() => this.unlinkSelectedGroups()}
                    disabled={this.props.readOnly}
                >
                    <i className='icon fa fa-unlink'/>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.unlink_selected'
                        defaultMessage='Unlink Selected Groups'
                    />
                </button>
            );
        default:
            return (
                <button
                    type='button'
                    className='btn btn-inactive disabled'
                    disabled={this.props.readOnly}
                >
                    <i className='icon fa fa-link'/>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.link_selected'
                        defaultMessage='Link Selected Groups'
                    />
                </button>
            );
        }
    }
    renderHeader = () => {
        if (this.props.groups.length === 0) {
            return null;
        }
        return (
            <div className='groups-list--header'>
                <div className='group-name'>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.nameHeader'
                        defaultMessage='Name'
                    />
                </div>
                <div className='group-content'>
                    <div className='group-description'>
                        <FormattedMessage
                            id='admin.group_settings.groups_list.mappingHeader'
                            defaultMessage='Mattermost Linking'
                        />
                    </div>
                    <div className='group-actions'/>
                </div>
            </div>
        );
    };

    public renderRows(): JSX.Element | JSX.Element[] {
        if (this.state.loading) {
            return (
                <div className='groups-list-loading'>
                    <i className='fa fa-spinner fa-pulse fa-2x'/>
                </div>
            );
        }
        if (this.state.fetchError) {
            return (
                <div className='groups-list-empty'>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.groups_list_error'
                        defaultMessage='Failed to retrieve LDAP groups. Please check your logs for details.'
                    />
                </div>
            );
        }
        if (this.props.groups.length === 0) {
            return (
                <div className='groups-list-empty'>
                    <FormattedMessage
                        id='admin.group_settings.groups_list.no_groups_found'
                        defaultMessage='No groups found'
                    />
                </div>
            );
        }
        return this.props.groups.map((item) => {
            return (
                <GroupRow
                    key={item.primary_key}
                    primary_key={item.primary_key}
                    name={item.name}
                    mattermost_group_id={item.mattermost_group_id}
                    has_syncables={item.has_syncables}
                    failed={item.failed}
                    checked={Boolean(this.state.checked[item.primary_key])}
                    onCheckToggle={(key: string) => this.onCheckToggle(key)}
                    readOnly={this.props.readOnly}
                    actions={{
                        link: this.props.actions.link,
                        unlink: this.props.actions.unlink,
                    }}
                />
            );
        });
    }

    public regex(str: string): RegExp {
        return new RegExp(`(${str})`, 'i');
    }

    public searchGroups(page?: number) {
        let {searchString} = this.state;

        const newState = {...this.state};

        let q = searchString;
        let opts = {q: ''};

        Object.entries(FILTER_STATE_SEARCH_KEY_MAPPING).forEach(([key, value]) => {
            const re = this.regex(value.filter);
            if (re.test(searchString)) {
                (newState as any)[key] = true;
                q = q.replace(re, '');
                opts = Object.assign(opts, value.option);
            } else if ((this.state as any)[key]) {
                searchString += ' ' + value.filter;
            }
        });

        opts.q = q.trim();

        newState.searchString = searchString;
        newState.showFilters = false;
        newState.loading = true;
        newState.showFilters = false;
        this.setState(newState);

        this.props.actions.getLdapGroups(page, LDAP_GROUPS_PAGE_SIZE, opts).then(this.handleGetGroupsResponse);
    }

    public handleGroupSearchKeyUp(e: any) {
        const {key} = e;
        const {searchString} = this.state;
        if (key === Constants.KeyCodes.ENTER[0]) {
            this.setState({page: 0});
            this.searchGroups();
        }
        const newState = {};
        Object.entries(FILTER_STATE_SEARCH_KEY_MAPPING).forEach(([k, value]) => {
            if (!this.regex(value.filter).test(searchString)) {
                (newState as any)[k] = false;
            }
        });
        this.setState(newState);
    }

    public newSearchString(searchString: string, stateKey: string, checked: boolean): string {
        let newSearchString = searchString;
        const {filter} = (FILTER_STATE_SEARCH_KEY_MAPPING as any)[stateKey];
        const re = this.regex(filter);
        const stringFilterPresent = re.test(searchString);

        if (stringFilterPresent && !checked) {
            newSearchString = searchString.replace(re, '').trim();
        }

        if (!stringFilterPresent && checked) {
            newSearchString += ' ' + filter;
        }

        return newSearchString.replace(/\s{2,}/g, ' ');
    }

    public handleFilterCheck(updates: FilterUpdates[]) {
        let {searchString} = this.state;
        updates.forEach((item: FilterUpdates) => {
            searchString = this.newSearchString(searchString, item[0], item[1]);
            this.setState({[item[0]]: item[1]} as any);
        });
        this.setState({searchString});
    }

    public renderSearchFilters(): JSX.Element {
        return (
            <div
                id='group-filters'
                className='group-search-filters'
                onClick={(e) => {
                    e.nativeEvent.stopImmediatePropagation();
                }}
            >
                <div className='filter-row'>
                    <span
                        className={'filter-check ' + (this.state.filterIsLinked ? 'checked' : '')}
                        onClick={() => this.handleFilterCheck([['filterIsLinked', !this.state.filterIsLinked], ['filterIsUnlinked', false]])}
                    >
                        {this.state.filterIsLinked && <CheckboxCheckedIcon/>}
                    </span>
                    <span>
                        <FormattedMessage
                            id='admin.group_settings.filters.isLinked'
                            defaultMessage='Is Linked'
                        />
                    </span>
                </div>
                <div className='filter-row'>
                    <span
                        className={'filter-check ' + (this.state.filterIsUnlinked ? 'checked' : '')}
                        onClick={() => this.handleFilterCheck([['filterIsUnlinked', !this.state.filterIsUnlinked], ['filterIsLinked', false]])}
                    >
                        {this.state.filterIsUnlinked && <CheckboxCheckedIcon/>}
                    </span>
                    <span>
                        <FormattedMessage
                            id='admin.group_settings.filters.isUnlinked'
                            defaultMessage='Is Not Linked'
                        />
                    </span>
                </div>
                <div className='filter-row'>
                    <span
                        className={'filter-check ' + (this.state.filterIsConfigured ? 'checked' : '')}
                        onClick={() => this.handleFilterCheck([['filterIsConfigured', !this.state.filterIsConfigured], ['filterIsUnconfigured', false]])}
                    >
                        {this.state.filterIsConfigured && <CheckboxCheckedIcon/>}
                    </span>
                    <span>
                        <FormattedMessage
                            id='admin.group_settings.filters.isConfigured'
                            defaultMessage='Is Configured'
                        />
                    </span>
                </div>
                <div className='filter-row'>
                    <span
                        className={'filter-check ' + (this.state.filterIsUnconfigured ? 'checked' : '')}
                        onClick={() => this.handleFilterCheck([['filterIsUnconfigured', !this.state.filterIsUnconfigured], ['filterIsConfigured', false]])}
                    >
                        {this.state.filterIsUnconfigured && <CheckboxCheckedIcon/>}
                    </span>
                    <span>
                        <FormattedMessage
                            id='admin.group_settings.filters.isUnconfigured'
                            defaultMessage='Is Not Configured'
                        />
                    </span>
                </div>
                <a
                    onClick={() => {
                        this.setState({page: 0});
                        this.searchGroups(0);
                    }}
                    className='btn btn-primary search-groups-btn'
                >
                    <FormattedMessage
                        id='search_bar.search'
                        defaultMessage='Search'
                    />
                </a>
            </div>
        );
    }

    resetFiltersAndSearch = () => {
        const newState: Partial<State> = {
            showFilters: false,
            searchString: '',
            loading: true,
            page: 0,
            filterIsConfigured: false,
            filterIsUnconfigured: false,
            filterIsLinked: false,
            filterIsUnlinked: false,
        };
        this.setState(newState as any);
        this.props.actions.getLdapGroups(this.state.page, LDAP_GROUPS_PAGE_SIZE, {q: ''}).then(this.handleGetGroupsResponse);
    };

    handleGetGroupsResponse = (response: any) => {
        if (response?.error) {
            this.setState({fetchError: true});
        } else {
            this.setState({fetchError: false});
        }
        this.setState({loading: false});
    };

    public render(): JSX.Element {
        const startCount = (this.state.page * LDAP_GROUPS_PAGE_SIZE) + 1;
        let endCount = (this.state.page * LDAP_GROUPS_PAGE_SIZE) + LDAP_GROUPS_PAGE_SIZE;
        const total = this.props.total;
        if (endCount > total) {
            endCount = total;
        }
        const lastPage = endCount === total;
        const firstPage = this.state.page === 0;
        return (
            <div className='groups-list'>
                <div className='groups-list--global-actions'>
                    <div className='group-list-search'>
                        <input
                            type='text'
                            placeholder={Utils.localizeMessage('search_bar.search', 'Search')}
                            onKeyUp={(e: any) => this.handleGroupSearchKeyUp(e)}
                            onChange={(e) => this.setState({searchString: e.target.value})}
                            value={this.state.searchString}
                        />
                        <SearchIcon
                            className='search__icon'
                            aria-hidden='true'
                        />
                        <i
                            className={'fa fa-times-circle group-filter-action ' + (this.state.searchString.length ? '' : 'hidden')}
                            onClick={() => this.resetFiltersAndSearch()}
                        />
                        <i
                            className={'fa fa-caret-down group-filter-action ' + (this.state.showFilters ? 'hidden' : '')}
                            onClick={() => {
                                document.addEventListener('click', this.closeFilters, {once: true});
                                this.setState({showFilters: true});
                            }}
                        />
                    </div>
                    {this.state.showFilters && this.renderSearchFilters()}
                    <div className='group-list-link-unlink'>
                        {this.renderSelectionActionButton()}
                    </div>
                </div>
                {this.renderHeader()}
                <div
                    id='groups-list--body'
                    className='groups-list--body'
                >
                    {this.renderRows()}
                </div>
                {total > 0 &&
                    <div className='groups-list--footer'>
                        <div className='counter'>
                            <FormattedMessage
                                id='admin.group_settings.groups_list.paginatorCount'
                                defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                                values={{
                                    startCount,
                                    endCount,
                                    total,
                                }}
                            />
                        </div>
                        <button
                            type='button'
                            className={'btn btn-link prev ' + (firstPage ? 'disabled' : '')}
                            onClick={(e: any) => this.previousPage(e)}
                            disabled={firstPage}
                        >
                            <PreviousIcon/>
                        </button>
                        <button
                            type='button'
                            className={'btn btn-link next ' + (lastPage ? 'disabled' : '')}
                            onClick={(e: any) => this.nextPage(e)}
                            disabled={lastPage}
                        >
                            <NextIcon/>
                        </button>
                    </div>
                }
            </div>
        );
    }
}

