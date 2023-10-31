// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {PostImage} from '@mattermost/types/posts';

import {getImageSrc} from 'utils/post_utils';

import {isSVGImage} from './is_svg_image';

type Props = {
    children: (src: string) => React.ReactNode;
    enableSVGs: boolean;
    hasImageProxy: boolean;
    imageMetadata?: PostImage;
    src: string;
}

const ExternalImage = (props: Props) => {
    const shouldRenderImage = props.enableSVGs || !isSVGImage(props.imageMetadata, props.src);
    let src = getImageSrc(props.src, props.hasImageProxy);
    if (!shouldRenderImage) {
        src = '';
    }
    return (<>{props.children(src)}</>);
};

export default memo(ExternalImage);
