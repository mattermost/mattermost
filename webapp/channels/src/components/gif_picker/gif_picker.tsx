// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import {GifsAppState, GfycatAPIItem} from '@mattermost/types/gifs';

import App from 'components/gif_picker/components/App';
import Categories from 'components/gif_picker/components/Categories';
import Search from 'components/gif_picker/components/Search';
import Trending from 'components/gif_picker/components/Trending';
import constants from 'components/gif_picker/utils/constants';

export const appProps: GifsAppState = {
    appName: constants.appName.mattermost,
    basePath: '/mattermost',
    itemTapType: constants.ItemTapAction.SHARE,
    appClassName: 'gfycat',
    shareEvent: 'shareMattermost',
    appId: 'mattermostwebviews',
    enableHistory: true,
    header: {
        tabs: [constants.Tab.TRENDING, constants.Tab.REACTIONS],
        displayText: false,
    },
};

type Props = {
    onGifClick?: (gif: string) => void;
    defaultSearchText?: string;
    handleSearchTextChange: (text: string) => void;
}

const GifPicker = (props: Props) => {
    const [action, setAction] = useState(props.defaultSearchText ? 'search' : 'trending');

    const handleTrending = () => setAction('trending');
    const handleCategories = () => setAction('reactions');
    const handleSearch = () => setAction('search');

    const handleItemClick = (gif: GfycatAPIItem) => {
        props.onGifClick?.('![' + gif.title?.replace(/]|\[/g, '\\$&') + '](' + gif.max5mbGif + ')');
    };

    let component;
    switch (action) {
    case 'reactions':
        component = (
            <Categories
                appProps={appProps}
                onTrending={handleTrending}
                onSearch={handleSearch}
            />
        );
        break;
    case 'search':
        component = (
            <Search
                appProps={appProps}
                onCategories={handleCategories}
                handleItemClick={handleItemClick}
            />
        );
        break;
    case 'trending':
        component = (
            <Trending
                appProps={appProps}
                onCategories={handleCategories}
                handleItemClick={handleItemClick}
            />
        );
        break;
    }
    return (
        <div>
            <App
                appProps={appProps}
                action={action}
                onTrending={handleTrending}
                onCategories={handleCategories}
                onSearch={handleSearch}
                defaultSearchText={props.defaultSearchText}
                handleSearchTextChange={props.handleSearchTextChange}
            >
                {component}
            </App>
        </div>
    );
};

export default GifPicker;
