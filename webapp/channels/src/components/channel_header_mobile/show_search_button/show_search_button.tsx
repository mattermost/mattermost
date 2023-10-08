// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import SearchIcon from 'components/widgets/icons/search_icon';

import {localizeMessage} from 'utils/utils';

type Actions = {
    openRHSSearch: () => void;
}

type Props = {
    actions: Actions;
}

const ShowSearchButton = ({actions}: Props) => {
    const {openRHSSearch} = actions;

    const handleClick = useCallback(() => {
        openRHSSearch();
    }, [openRHSSearch]);

    return (
        <button
            type='button'
            className='navbar-toggle navbar-right__icon navbar-search pull-right'
            onClick={handleClick}
            aria-label={localizeMessage('accessibility.button.Search', 'Search')}
        >
            <SearchIcon
                className='icon icon__search'
                aria-hidden='true'
            />
        </button>
    );
};

export default ShowSearchButton;
