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

/**
 * useExternalLink is used when linking outside of the MM server to add extra tracking parameters when linking to any
 * page on mattermost.com (such as our docs or marketing websites). When passed any URL that isn't on mattermost.com,
 * it returns the original URL unmodified.
 *
 * @param href The external URL being linked to
 * @param location The location of the link within the app
 * @param overwriteQueryParams
 * @return {[string, Record<string, string>]} A tuple containing the URL (whether or not it was modified) and all query
 * parameters on that link (either pre-existing or added by this hook)
 */
export function useExternalLink(href: string, location: string = '', overwriteQueryParams: ExternalLinkQueryParams = {}): [string, Record<string, string>] {
    const userId = useSelector(getCurrentUserId);
    const config = useSelector(getConfig);
    const license = useSelector(getLicense);
    const isCloudPreview = useSelector((state: GlobalState) => {
        return state.entities?.cloud?.subscription?.is_cloud_preview === true;
    });
    const telemetryId = useSelector((state: GlobalState) => getConfig(state)?.TelemetryId || '');
    const isCloud = useSelector((state: GlobalState) => getLicense(state)?.Cloud === 'true');

    return useMemo(() => {
        let parsedUrl;
        try {
            parsedUrl = new URL(href);
        } catch {
            return [href, {}];
        }

        if (parsedUrl.hostname !== 'mattermost.com' && !parsedUrl.hostname.endsWith('.mattermost.com')) {
            return [href, {}];
        }

        if (parsedUrl.protocol === 'mailto:') {
            return [href, {}];
        }

        // Determine edition type (enterprise vs team)
        const isEnterpriseReady = config?.BuildEnterpriseReady === 'true';
        const edition = isEnterpriseReady ? 'enterprise' : 'team';

        // Determine server version
        const serverVersion = config?.BuildNumber === 'dev' ? config.BuildNumber : (config?.Version || '');

        // Determine utm_medium based on cloud preview, cloud, or regular
        let utmMedium = 'in-product';
        if (isCloudPreview) {
            utmMedium = 'in-product-preview';
        } else if (isCloud) {
            utmMedium = 'in-product-cloud';
        }

        const existingURLSearchParams = parsedUrl.searchParams;
        const existingQueryParamsObj = Object.fromEntries(existingURLSearchParams.entries());
        const queryParams = {
            utm_source: 'mattermost',
            utm_medium: utmMedium,
            utm_content: location,
            uid: userId,
            sid: telemetryId,
            edition,
            server_version: serverVersion,
            ...overwriteQueryParams,
            ...existingQueryParamsObj,
        };
        parsedUrl.search = Object.entries(queryParams).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&');

        return [parsedUrl.toString(), queryParams];
    }, [href, isCloud, isCloudPreview, location, overwriteQueryParams, telemetryId, userId, config, license]);
}
