// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useSelector} from 'react-redux';

import {getConfig} from 'mattermost-redux/selectors/entities/general';

import {getDocumentationURL} from 'utils/documentation';
import {getSiteURL} from 'utils/url';

import type {GlobalState} from 'types/store';

/**
 * useDocumentationURL points a docs.mattermost.com link at the documentation bundled with the server when it is
 * available. ExternalLink already does this, so only use it for links opened another way.
 */
export function useDocumentationURL(url: string): string {
    const siteURL = useSelector((state: GlobalState) => getConfig(state)?.SiteURL) || getSiteURL();
    return getDocumentationURL(url, siteURL);
}
