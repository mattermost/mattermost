// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import {connect} from 'react-redux';

import type {GfycatAPIItem} from '@mattermost/types/gifs';

import {getImageSrc} from 'utils/post_utils';

import type {GlobalState} from 'types/store';

import './SearchItem.scss';

function mapStateToProps(state: GlobalState) {
    return {
        hasImageProxy: state.entities.general.config.HasImageProxy,
    };
}

type Props = {
    gfyItem: GfycatAPIItem;
    top: string;
    left: string;
    itemWidth: number;
    itemClickHandler: (gif: GfycatAPIItem) => void;
    hasImageProxy?: string;
}

export class SearchItem extends PureComponent<Props> {
    render() {
        const {
            gfyItem,
            top,
            left,
            itemWidth,
            itemClickHandler,
        } = this.props;

        const {width, height, max1mbGif, max2mbGif, avgColor} = gfyItem;
        const {hasImageProxy} = this.props;
        const url = getImageSrc(max1mbGif || max2mbGif, hasImageProxy === 'true');

        const backgroundImage = {backgroundImage: `url(${url})`};
        const backgroundColor = {backgroundColor: avgColor};
        const paddingBottom = {paddingBottom: ((itemWidth / width) * height) + 'px'};

        return (
            <div
                className='search-item-wrapper'
                style={{top, left, width: itemWidth ? `${itemWidth}px` : ''}}
            >
                <div
                    className='search-item'
                    style={{...backgroundImage, ...backgroundColor, ...paddingBottom}}
                    onClick={() => itemClickHandler(gfyItem)}
                />
            </div>
        );
    }
}

export default connect(mapStateToProps)(SearchItem);
