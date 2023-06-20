// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {connect} from 'react-redux';

import {GfycatAPIItem, GfycatAPITag} from '@mattermost/types/gifs';

import {requestCategoriesList, requestCategoriesListIfNeeded, saveSearchBarText, saveSearchScrollPosition, searchTextUpdate} from 'mattermost-redux/actions/gifs';

import {GlobalState} from 'types/store';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import {getImageSrc} from 'utils/post_utils';

import InfiniteScroll from 'components/gif_picker/components/InfiniteScroll';
import {appProps} from 'components/gif_picker/gif_picker';

import './Categories.scss';

function mapStateToProps(state: GlobalState) {
    return {
        tagsList: state.entities.gifs.categories.tagsList,
        hasMore: state.entities.gifs.categories.hasMore,
        gifs: state.entities.gifs.cache.gifs,
        searchText: state.entities.gifs.search.searchText,
        searchBarText: state.entities.gifs.search.searchBarText,
        hasImageProxy: state.entities.general.config.HasImageProxy,
    };
}

const mapDispatchToProps = ({
    saveSearchBarText,
    saveSearchScrollPosition,
    searchTextUpdate,
    requestCategoriesList,
    requestCategoriesListIfNeeded,
});

type Props = {
    appProps: typeof appProps;
    gifs?: Record<string, GfycatAPIItem>;
    hasMore?: boolean;
    onSearch: () => void;
    onTrending: () => void;
    requestCategoriesList: () => void;
    requestCategoriesListIfNeeded: () => void;
    saveSearchBarText: (searchBarText: string) => void;
    saveSearchScrollPosition: (scrollPosition: number) => void;
    searchTextUpdate: (searchText: string) => void;
    searchBarText: string;
    tagsList: GfycatAPITag[];
    hasImageProxy?: string;
}

export class Categories extends PureComponent<Props> {
    componentDidMount() {
        window.scrollTo(0, 0);
        this.props.requestCategoriesListIfNeeded();
        this.sendImpressions();
    }

    sendImpressions = () => {
        const {tagsList} = this.props;
        const gfycats = tagsList.map((tag) => {
            return {gfyId: tag.gfyId};
        });

        if (gfycats.length) {
            trackEvent('gfycat', 'views', {context: 'category_list', count: gfycats.length});
        }
    };

    componentWillUnmount() {
        this.props.saveSearchScrollPosition(0);
    }

    filterTagsList = () => {
        const {searchBarText, tagsList} = this.props;

        const substr = searchBarText.toLowerCase().trim().split(/ +/).join(' ');
        return tagsList && tagsList.length ? tagsList.filter((tag) => {
            if (!searchBarText || tag.tagName.indexOf(substr) !== -1) {
                return tag;
            }
            return '';
        }) : [];
    };

    loadMore = () => this.props.requestCategoriesList();

    render() {
        const {hasMore, tagsList, gifs, onSearch, onTrending, hasImageProxy} = this.props;

        const content = tagsList && tagsList.length ? this.filterTagsList().map((item, index) => {
            const {tagName, gfyId} = item;

            if (!gifs?.[gfyId]) {
                return null;
            }

            const gfyItem = gifs[gfyId];
            const {max1mbGif, max2mbGif, avgColor} = gfyItem;
            const url = getImageSrc(max1mbGif || max2mbGif, hasImageProxy === 'true');
            const searchText = tagName.replace(/\s/g, '-');
            const backgroundImage = {backgroundImage: `url(${url}`};
            const backgroundColor = {backgroundColor: avgColor};
            const props = this.props;
            function callback() {
                props.searchTextUpdate(tagName);
                props.saveSearchBarText(tagName);
                if (searchText === 'trending') {
                    onTrending();
                } else {
                    onSearch();
                }
            }
            return (
                <a
                    onClick={callback}
                    key={index}
                >
                    <div className='category-container'>
                        <div
                            className='category'
                            style={{...backgroundImage, ...backgroundColor}}
                        >
                            <div className='category-name'>{tagName}</div>
                        </div>
                    </div>
                </a>
            );
        }) : [];

        return content && content.length ? (
            <div className='categories-container'>
                <InfiniteScroll
                    hasMore={hasMore}
                    loadMore={this.loadMore}
                    threshold={1}
                >
                    {content}
                </InfiniteScroll>
            </div>
        ) : (
            <div className='categories-container'/>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Categories);
