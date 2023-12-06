// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {Link} from 'react-router-dom';

import LoadingScreen from 'components/loading_screen';
import SearchIcon from 'components/widgets/icons/fa_search_icon';

import {localizeMessage} from 'utils/utils';

type Props = {
    children?: ReactNode | ((filter: string) => void);
    header: ReactNode;
    addLink?: string;
    addText?: ReactNode;
    addButtonId?: string;
    emptyText?: ReactNode;
    emptyTextSearch?: JSX.Element;
    helpText?: ReactNode;
    loading: boolean;
    searchPlaceholder?: string;
};

const BackstageList = ({searchPlaceholder = localizeMessage('backstage_list.search', 'Search'), ...remainingProps}: Props) => {
    const [filter, setFilter] = useState('');

    const updateFilter = (e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value);

    const filterLowered = filter.toLowerCase();

    let children;
    if (remainingProps.loading) {
        children = <LoadingScreen/>;
    } else {
        children = remainingProps.children;
        let hasChildren = true;
        if (typeof children === 'function') {
            [children, hasChildren] = children(filterLowered);
        }
        children = React.Children.map(children, (child) => {
            return React.cloneElement(child, {filterLowered});
        });
        if (children.length === 0 || !hasChildren) {
            if (!filterLowered) {
                if (remainingProps.emptyText) {
                    children = (
                        <div className='backstage-list__item backstage-list__empty'>
                            {remainingProps.emptyText}
                        </div>
                    );
                }
            } else if (remainingProps.emptyTextSearch) {
                children = (
                    <div
                        className='backstage-list__item backstage-list__empty'
                        id='emptySearchResultsMessage'
                    >
                        {React.cloneElement(remainingProps.emptyTextSearch, {values: {searchTerm: filterLowered}})}
                    </div>
                );
            }
        }
    }

    let addLink = null;

    if (remainingProps.addLink && remainingProps.addText) {
        addLink = (
            <Link
                className='add-link'
                to={remainingProps.addLink}
            >
                <button
                    type='button'
                    className='btn btn-primary'
                    id={remainingProps.addButtonId}
                >
                    <span>
                        {remainingProps.addText}
                    </span>
                </button>
            </Link>
        );
    }

    return (
        <div className='backstage-content'>
            <div className='backstage-header'>
                <h1>
                    {remainingProps.header}
                </h1>
                {addLink}
            </div>
            <div className='backstage-filters'>
                <div className='backstage-filter__search'>
                    <SearchIcon/>
                    <input
                        type='search'
                        className='form-control'
                        placeholder={searchPlaceholder}
                        value={filter}
                        onChange={updateFilter}
                        style={style.search}
                        id='searchInput'
                    />
                </div>
            </div>
            <span className='backstage-list__help'>
                {remainingProps.helpText}
            </span>
            <div className='backstage-list'>
                {children}
            </div>
        </div>
    );
};

const style = {
    search: {flexGrow: 0, flexShrink: 0},
};

export default BackstageList;
