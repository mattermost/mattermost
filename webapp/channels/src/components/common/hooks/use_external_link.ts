// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useMemo} from 'react';
import {useSelector} from 'react-redux';

import {getConfig, getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

export type ExternalLinkQueryParams = {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    userId?: string;
}

export function useExternalLink(href: string, location: string = '', overwriteQueryParams: ExternalLinkQueryParams = {}): [string, Record<string, string>] {
    const userId = useSelector(getCurrentUserId);
    const telemetryId = useSelector((state: GlobalState) => getConfig(state).TelemetryId || '');
    const isCloud = useSelector((state: GlobalState) => getLicense(state).Cloud === 'true');

    return useMemo(() => {
        if (!href?.includes('mattermost.com')) {
            return [href, {}];
        }

        const parsedUrl = new URL(href);

        const existingURLSearchParams = parsedUrl.searchParams;
        const existingQueryParamsObj = Object.fromEntries(existingURLSearchParams.entries());
        const queryParams = {
            utm_source: 'mattermost',
            utm_medium: isCloud ? 'in-product-cloud' : 'in-product',
            utm_content: location,
            uid: userId,
            sid: telemetryId,
            ...overwriteQueryParams,
            ...existingQueryParamsObj,
        };
        parsedUrl.search = new URLSearchParams(queryParams).toString();

        return [parsedUrl.toString(), queryParams];
    }, [href, isCloud, location, overwriteQueryParams, telemetryId, userId]);
}
