// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';

import type {PostImage} from '@mattermost/types/posts';

import {getImageSrc} from 'utils/post_utils';
import {isExternalImageURL} from 'utils/url';

import {isSVGImage} from './is_svg_image';

type BlockReason = 'external' | 'svg';

type Props = {
    blockExternalImages?: boolean;
    children: (src: string, blockReason?: BlockReason) => React.ReactNode;
    enableSVGs: boolean;
    hasImageProxy: boolean;
    imageMetadata?: PostImage;
    siteURL?: string;
    src: string;
};

const ExternalImage = (props: Props) => {
    const isBlockedExternal = Boolean(props.blockExternalImages) && isExternalImageURL(props.src, props.siteURL ?? '');
    const isBlockedSVG = !isBlockedExternal && !props.enableSVGs && isSVGImage(props.imageMetadata, props.src);

    let blockReason: BlockReason | undefined;
    if (isBlockedExternal) {
        blockReason = 'external';
    } else if (isBlockedSVG) {
        blockReason = 'svg';
    }

    const src = blockReason ? '' : getImageSrc(props.src, props.hasImageProxy);
    return (<>{blockReason ? props.children(src, blockReason) : props.children(src)}</>);
};

export default memo(ExternalImage);
