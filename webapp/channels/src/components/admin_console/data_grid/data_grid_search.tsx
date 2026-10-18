// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, memo, type JSX} from 'react';
import {useIntl} from 'react-intl';

import {SearchInput} from '@mattermost/compass-ui/components/search-input';

import Filter from 'components/admin_console/filter/filter';
import type {FilterOptions} from 'components/admin_console/filter/filter';

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
};

const DataGridSearch = ({
    term: termFromProps = '',
    extraComponent,
    filterProps,
    onSearch,
    disabled,
}: Props) => {
    const {formatMessage} = useIntl();

    const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        onSearch(e.target.value);
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
                <SearchInput
                    size='small'
                    placeholder={formatMessage({id: 'search_bar.search', defaultMessage: 'Search'})}
                    onChange={handleSearch}
                    onClear={resetSearch}
                    value={termFromProps}
                    data-testid='searchInput'
                    clearButtonProps={{'data-testid': 'clear-search', tabIndex: 0}}
                    disabled={disabled}
                />
            </div>

            {filter}
            {extraComponent}
        </div>
    );
};

export default memo(DataGridSearch);
