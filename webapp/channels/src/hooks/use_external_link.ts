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
    const config = useSelector(getConfig);
    const license = useSelector(getLicense);
    const isCloudPreview = useSelector((state: GlobalState) => {
        return state.entities?.cloud?.subscription?.is_cloud_preview === true;
    });
    const telemetryId = useSelector((state: GlobalState) => getConfig(state)?.TelemetryId || '');
    const isCloud = useSelector((state: GlobalState) => getLicense(state)?.Cloud === 'true');

    return useMemo(() => {
        if (!href?.includes('mattermost.com') || href?.startsWith('mailto:')) {
            return [href, {}];
        }

        const parsedUrl = new URL(href);

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
