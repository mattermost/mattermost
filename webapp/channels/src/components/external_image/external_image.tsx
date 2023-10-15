// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
import { ReactElement, memo } from 'react';

import type {PostImage} from '@mattermost/types/posts';

import {getImageSrc} from 'utils/post_utils';
import { isSVGImage } from './external_image_isSVGImage';

interface Props {
    children: (src: string) => ReactElement | null
    enableSVGs: boolean;
    hasImageProxy: boolean;
    imageMetadata?: PostImage;
    src: string;
}

const ExternalImage = ({ 
    enableSVGs, 
    children, 
    hasImageProxy, 
    imageMetadata = undefined, 
    src 
}: Props) => {

  const shouldRenderImage = () => enableSVGs || !isSVGImage(imageMetadata, src)

  let srcStr = !shouldRenderImage()
    ? ''
    : getImageSrc(src, hasImageProxy);

  return children(srcStr)
}

export default memo(ExternalImage)
