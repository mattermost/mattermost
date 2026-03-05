// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, memo} from 'react';
import {defineMessage} from 'react-intl';

import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';
import LocalizedPlaceholderInput from 'components/localized_placeholder_input';
import FaSearchIcon from 'components/widgets/icons/fa_search_icon';

import './data_grid.scss';

type Props = {
    onSearch: (term: string) => void;
    term?: string;
    extraComponent?: JSX.Element;
    disabled?: boolean;

    filterProps?: {
        options: FilterOptions;
        keys: string[];
        onFilter: (options: FilterOptions) => void;
    };
}

const DataGridSearch = ({
    term: termFromProps = '',
    extraComponent,
    filterProps,
    onSearch,
    disabled,
}: Props) => {
    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const term = e.target.value;

        onSearch(term);
    }, [onSearch]);

    const resetSearch = useCallback(() => {
        onSearch('');
    }, [onSearch]);

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
                    onChange={handleSearch}
                    value={termFromProps}
                    data-testid='searchInput'
                    disabled={disabled}
                />
                <i
                    className={'DataGrid_clearButton fa fa-times-circle ' + (termFromProps.length ? '' : 'hidden')}
                    onClick={resetSearch}
                    data-testid='clear-search'
                />
            </div>

            {filter}
            {extraComponent}
        </div>
    );
};

export default memo(DataGridSearch);
