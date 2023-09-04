// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {throttle} from 'lodash';
import React, {PureComponent} from 'react';
import {connect} from 'react-redux';

import type {GfycatAPIItem} from '@mattermost/types/gifs';

import {searchIfNeededInitial, searchGfycat} from 'mattermost-redux/actions/gifs';

import SearchGrid from 'components/gif_picker/components/SearchGrid';

import type {GlobalState} from 'types/store';

const GIF_SEARCH_THROTTLE_TIME_MS = 1000;

function mapStateToProps(state: GlobalState) {
    return {
        searchText: state.entities.gifs.search.searchText,
    };
}

const mapDispatchToProps = ({
    searchGfycat,
    searchIfNeededInitial,
});

type Props = {
    appProps: any;
    onCategories?: () => void;
    handleItemClick: (gif: GfycatAPIItem) => void;
    searchText: string;
    searchIfNeededInitial: (searchText: string) => void;
    searchGfycat: (params: {searchText: string; count?: number; startIndex?: number }) => void;
}

export class Search extends PureComponent<Props> {
    componentDidMount() {
        const {searchText} = this.props;
        this.props.searchIfNeededInitial(searchText.split('-').join(' '));
    }

    componentDidUpdate(prevProps: Props) {
        const {searchText} = this.props;
        if (prevProps.searchText !== searchText) {
            this.throttledSearchGif(searchText);
        }
    }

    throttledSearchGif = throttle(
        (searchText) => this.props.searchIfNeededInitial(searchText.split('-').join(' ')),
        GIF_SEARCH_THROTTLE_TIME_MS,
    );

    loadMore = () => {
        const {searchText} = this.props;
        this.props.searchGfycat({searchText});
    };

    render() {
        const {handleItemClick, searchText, onCategories} = this.props;

        return (
            <SearchGrid
                keyword={searchText}
                handleItemClick={handleItemClick}
                onCategories={onCategories}
                loadMore={this.loadMore}
            />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Search);
