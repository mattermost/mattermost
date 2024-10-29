// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import type {ChangeEvent, ReactNode} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {Link} from 'react-router-dom';

import LoadingScreen from 'components/loading_screen';
import NextIcon from 'components/widgets/icons/fa_next_icon';
import PreviousIcon from 'components/widgets/icons/fa_previous_icon';
import SearchIcon from 'components/widgets/icons/fa_search_icon';

import './backstage_list.scss';

type Props = {
    children?: JSX.Element[] | ((filter: string) => [JSX.Element[], boolean]);
    header: ReactNode;
    addLink?: string;
    addText?: ReactNode;
    addButtonId?: string;
    emptyText?: ReactNode;
    emptyTextSearch?: JSX.Element;
    helpText?: ReactNode;
    loading: boolean;
    searchPlaceholder?: string;
    nextPage?: () => void;
    previousPage?: () => void;
    page?: number;
    pageSize?: number;
    total?: number;
};

const getPaging = (remainingProps: Props, childCount: number, hasFilter: boolean) => {
    const page = (hasFilter || !remainingProps.page) ? 0 : remainingProps.page;
    const pageSize = (hasFilter || !remainingProps.pageSize) ? childCount : remainingProps.pageSize;
    const total = (hasFilter || !remainingProps.total) ? childCount : remainingProps.total;

    let startCount = (page * pageSize) + 1;
    let endCount = (page + 1) * pageSize;
    endCount = endCount > total ? total : endCount;
    if (endCount === 0) {
        startCount = 0;
    }

    const isFirstPage = startCount <= 1;
    const isLastPage = endCount >= total;

    return {startCount, endCount, total, isFirstPage, isLastPage};
};

const BackstageList = (remainingProps: Props) => {
    const {formatMessage} = useIntl();

    const [filter, setFilter] = useState('');
    const updateFilter = (e: ChangeEvent<HTMLInputElement>) => setFilter(e.target.value);
    const filterLowered = filter.toLowerCase();

    let searchPlaceholder;
    if (remainingProps.searchPlaceholder) {
        searchPlaceholder = remainingProps.searchPlaceholder;
    } else {
        searchPlaceholder = formatMessage({id: 'backstage_list.search', defaultMessage: 'Search'});
    }

    let children = [];
    let childCount = 0;
    if (remainingProps.loading) {
        children = [
            <LoadingScreen
                key='loading'
            />,
        ];
    } else {
        let hasChildren = true;
        if (typeof remainingProps.children === 'function') {
            [children, hasChildren] = remainingProps.children(filterLowered);
        } else {
            children = remainingProps.children as JSX.Element[];
        }
        children = React.Children.map(children, (child) => {
            return React.cloneElement(child, {filterLowered});
        });
        if (children.length === 0 || !hasChildren) {
            if (!filterLowered) {
                if (remainingProps.emptyText) {
                    children = [(
                        <div
                            className='backstage-list__item backstage-list__empty'
                            key='emptyText'
                        >
                            {remainingProps.emptyText}
                        </div>
                    )];
                }
            } else if (remainingProps.emptyTextSearch) {
                children = [(
                    <div
                        className='backstage-list__item backstage-list__empty'
                        id='emptySearchResultsMessage'
                        key='emptyTextSearch'
                    >
                        {React.cloneElement(remainingProps.emptyTextSearch, {values: {...remainingProps.emptyTextSearch.props.values, searchTerm: filterLowered}})}
                    </div>
                )];
            }
        } else {
            childCount = children.length;
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

    const hasFilter = filter.length > 0;
    const {startCount, endCount, total, isFirstPage, isLastPage} = getPaging(remainingProps, childCount, hasFilter);
    const childrenToDisplay = childCount > 0 ? children.slice(startCount - 1, endCount) : children;

    let previousPageFn = remainingProps.previousPage;
    let nextPageFn = remainingProps.nextPage;
    if (isFirstPage) {
        previousPageFn = () => {};
    }
    if (isLastPage) {
        nextPageFn = () => {};
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
                        id='searchInput'
                    />
                </div>
            </div>
            <span className='backstage-list__help'>
                {remainingProps.helpText}
            </span>
            <div className='backstage-list'>
                {childrenToDisplay}
            </div>
            <div className='backstage-footer'>
                <div className='backstage-footer__cell'>
                    <FormattedMessage
                        id='backstage_list.paginatorCount'
                        defaultMessage='{startCount, number} - {endCount, number} of {total, number}'
                        values={{
                            startCount,
                            endCount,
                            total,
                        }}
                    />
                    <button
                        type='button'
                        className={'btn btn-quaternary btn-icon btn-sm ml-2 prev ' + (isFirstPage ? 'disabled' : '')}
                        onClick={previousPageFn}
                        aria-label={formatMessage({id: 'backstage_list.previousButton.ariaLabel', defaultMessage: 'Previous'})}
                    >
                        <PreviousIcon/>
                    </button>
                    <button
                        type='button'
                        className={'btn btn-quaternary btn-icon btn-sm next ' + (isLastPage ? 'disabled' : '')}
                        onClick={nextPageFn}
                        aria-label={formatMessage({id: 'backstage_list.nextButton.ariaLabel', defaultMessage: 'Next'})}
                    >
                        <NextIcon/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BackstageList;
