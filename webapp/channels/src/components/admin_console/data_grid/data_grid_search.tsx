// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Filter from 'components/admin_console/filter/filter';
import FaSearchIcon from 'components/widgets/icons/fa_search_icon';

import * as Utils from 'utils/utils';

import type {FilterOptions} from 'components/admin_console/filter/filter';

import './data_grid.scss';

type Props = {
    onSearch: (term: string) => void;
    placeholder?: string;
    term: string;
    extraComponent?: JSX.Element;

    filterProps?: {
        options: FilterOptions;
        keys: string[];
        onFilter: (options: FilterOptions) => void;
    };
}

type State = {
    term: string;
}

class DataGridSearch extends React.PureComponent<Props, State> {
    static defaultProps = {
        placeholder: '',
        term: '',
    };

    public constructor(props: Props) {
        super(props);

        this.state = {
            term: '',
        };
    }

    handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;
        this.setState({term});
        this.props.onSearch(term);
    };

    resetSearch = () => {
        this.props.onSearch('');
    };

    onFilter = (filters: FilterOptions) => {
        this.props.filterProps?.onFilter(filters);
    };

    render() {
        const {filterProps} = this.props;

        let {placeholder} = this.props;
        if (!placeholder) {
            placeholder = Utils.localizeMessage('search_bar.search', 'Search');
        }

        let filter;
        if (filterProps) {
            filter = <Filter {...filterProps}/>;
        }

        return (
            <div className='DataGrid_search'>
                <div className='DataGrid_searchBar'>
                    <span
                        className='DataGrid_searchIcon'
                        aria-hidden='true'
                    >
                        <FaSearchIcon/>
                    </span>

                    <input
                        type='text'
                        placeholder={Utils.localizeMessage('search_bar.search', 'Search')}
                        onChange={this.handleSearch}
                        value={this.props.term}
                        data-testid='searchInput'
                    />
                    <i
                        className={'DataGrid_clearButton fa fa-times-circle ' + (this.props.term.length ? '' : 'hidden')}
                        onClick={this.resetSearch}
                        data-testid='clear-search'
                    />
                </div>

                {filter}
                {this.props.extraComponent}
            </div>
        );
    }
}

export default DataGridSearch;
