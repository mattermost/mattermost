// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {PostImage} from '@mattermost/types/posts';
import React from 'react';

import {getImageSrc} from 'utils/post_utils';

interface Props {
    children: (src: string) => React.ReactNode;
    enableSVGs: boolean;
    hasImageProxy: boolean;
    imageMetadata?: PostImage;
    src: string;
}

export default class ExternalImage extends React.PureComponent<Props> {
    isSVGImage = () => {
        if (!this.props.imageMetadata) {
            // Just check if the string contains an svg extension instead of if it ends with one because it avoids
            // having to deal with query strings and proxied image URLs
            return this.props.src.indexOf('.svg') !== -1;
        }

        return this.props.imageMetadata.format === 'svg';
    };

    shouldRenderImage = () => {
        // Return true unless the image is an SVG and we have SVG rendering disabled
        return this.props.enableSVGs || !this.isSVGImage();
    };

    render() {
        let src = getImageSrc(this.props.src, this.props.hasImageProxy);

        if (!this.shouldRenderImage()) {
            src = '';
        }

        return this.props.children(src);
    }
}
