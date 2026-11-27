// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {PostImage} from '@mattermost/types/posts';

import {getImageSrc} from 'utils/post_utils';
import {isExternalImageURL} from 'utils/url';

import {isSVGImage} from './is_svg_image';

type Props = {
    blockExternalImages?: boolean;
    children: (src: string, blockedReason?: 'external') => React.ReactNode;
    enableSVGs: boolean;
    hasImageProxy: boolean;
    imageMetadata?: PostImage;
    siteURL?: string;
    src: string;
};

const ExternalImage = (props: Props) => {
    if (props.blockExternalImages && isExternalImageURL(props.src, props.siteURL)) {
        return (<>{props.children('', 'external')}</>);
    }

    const shouldRenderImage = props.enableSVGs || !isSVGImage(props.imageMetadata, props.src);
    const src = shouldRenderImage ? getImageSrc(props.src, props.hasImageProxy) : '';
    return (<>{props.children(src)}</>);
};

export default memo(ExternalImage);
