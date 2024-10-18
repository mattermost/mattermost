// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessage} from 'react-intl';

import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import LocalizedPlaceholderInput from 'components/localized_placeholder_input';
import FaSearchIcon from 'components/widgets/icons/fa_search_icon';

import './data_grid.scss';

type Props = {
    onSearch: (term: string) => void;
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

                    <LocalizedPlaceholderInput
                        type='text'
                        placeholder={defineMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
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
