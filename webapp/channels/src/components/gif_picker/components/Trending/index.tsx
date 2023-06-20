// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {connect} from 'react-redux';

import {GfycatAPIItem} from '@mattermost/types/gifs';

import {
    searchCategory,
    searchIfNeededInitial,
    saveSearchScrollPosition,
} from 'mattermost-redux/actions/gifs';

import SearchGrid from 'components/gif_picker/components/SearchGrid';
import {appProps} from 'components/gif_picker/gif_picker';

const mapDispatchToProps = ({
    searchCategory,
    searchIfNeededInitial,
    saveSearchScrollPosition,
});

type Props = {
    appProps: typeof appProps;
    searchIfNeededInitial: (searchText: string) => void;
    onCategories: () => void;
    saveSearchScrollPosition: (scrollPosition: number) => void;
    handleItemClick: (gif: GfycatAPIItem) => void;
    searchCategory: (params: {tagName?: string}) => void;
}

export class Trending extends PureComponent<Props> {
    componentDidMount() {
        this.props.searchIfNeededInitial('trending');
    }

    componentWillUnmount() {
        this.props.saveSearchScrollPosition(0);
    }

    loadMore = () => this.props.searchCategory({tagName: 'trending'});

    render() {
        const {handleItemClick, onCategories} = this.props;
        return (
            <SearchGrid
                keyword='trending'
                handleItemClick={handleItemClick}
                onCategories={onCategories}
                loadMore={this.loadMore}
            />
        );
    }
}

export default connect(null, mapDispatchToProps)(Trending);
