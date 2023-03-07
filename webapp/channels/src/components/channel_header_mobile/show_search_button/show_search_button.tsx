// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {localizeMessage} from 'utils/utils';

import SearchIcon from 'components/widgets/icons/search_icon';

type Actions = {
    openRHSSearch: () => void;
}

type Props = {
    actions: Actions;
}

export default class ShowSearchButton extends React.PureComponent<Props> {
    handleClick = () => {
        this.props.actions.openRHSSearch();
    }

    render() {
        return (
            <button
                type='button'
                className='navbar-toggle navbar-right__icon navbar-search pull-right'
                onClick={this.handleClick}
                aria-label={localizeMessage('accessibility.button.Search', 'Search')}
            >
                <SearchIcon
                    className='icon icon__search'
                    aria-hidden='true'
                />
            </button>
        );
    }
}
