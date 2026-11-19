// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {isExternalImageBlocked} from 'utils/url';

export function useAllowedImageURL(src?: string): string | undefined {
    const config = useSelector(getConfig);
    return isExternalImageBlocked(src, config) ? undefined : src;
}

type Props = {
    src?: string;
    children: (allowedSrc: string | undefined) => React.ReactNode;
};

// Gates an image URL against ServiceSettings.BlockExternalImages without proxy rewriting or SVG filtering.
export default function AllowedImage({src, children}: Props) {
    const allowedSrc = useAllowedImageURL(src);
    return <>{children(allowedSrc)}</>;
}
