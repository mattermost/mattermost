// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage} from 'react-intl';

import {
    BellOutlineIcon,
    CogOutlineIcon,
    FileTextOutlineIcon,
    KeyVariantIcon,
    LayersOutlineIcon,
    LockOutlineIcon,
    MagnifyIcon,
    ServerOutlineIcon,
    SitemapIcon,
    SyncIcon,
    UpdateIcon,
} from '@mattermost/compass-icons/components';
import type {HealthFinding} from '@mattermost/types/health';

import {SEVERITIES} from './severity';

const areaMessages = defineMessages({
    auth: {id: 'admin.health_dashboard.area.auth', defaultMessage: 'Authentication'},
    database: {id: 'admin.health_dashboard.area.database', defaultMessage: 'Database'},
    search: {id: 'admin.health_dashboard.area.search', defaultMessage: 'Search'},
    jobs: {id: 'admin.health_dashboard.area.jobs', defaultMessage: 'Jobs'},
    cluster: {id: 'admin.health_dashboard.area.cluster', defaultMessage: 'High availability'},
    notifications: {id: 'admin.health_dashboard.area.notifications', defaultMessage: 'Notifications'},
    compliance: {id: 'admin.health_dashboard.area.compliance', defaultMessage: 'Compliance'},
    platform: {id: 'admin.health_dashboard.area.platform', defaultMessage: 'Platform'},
    license: {id: 'admin.health_dashboard.area.license', defaultMessage: 'Licensing'},
    version: {id: 'admin.health_dashboard.area.version', defaultMessage: 'Updates'},
});

type KnownArea = keyof typeof areaMessages;

const areaIcons: Record<KnownArea, typeof CogOutlineIcon> = {
    auth: LockOutlineIcon,
    database: LayersOutlineIcon,
    search: MagnifyIcon,
    jobs: SyncIcon,
    cluster: SitemapIcon,
    notifications: BellOutlineIcon,
    compliance: FileTextOutlineIcon,
    platform: ServerOutlineIcon,
    license: KeyVariantIcon,
    version: UpdateIcon,
};

const areaOrder = Object.keys(areaMessages);

function isKnownArea(area: string): area is KnownArea {
    return Object.hasOwn(areaMessages, area);
}

export const AreaLabel = ({area}: {area: string}) => {
    if (!isKnownArea(area)) {
        return <>{area}</>;
    }
    return <FormattedMessage {...areaMessages[area]}/>;
};

export const AreaIcon = ({area}: {area: string}) => {
    const Icon = isKnownArea(area) ? areaIcons[area] : CogOutlineIcon;
    return (
        <Icon
            size={16}
            color='currentColor'
            aria-hidden={true}
        />
    );
};

function areaRank(area: string) {
    const index = areaOrder.indexOf(area);
    return index === -1 ? areaOrder.length : index;
}

// Areas holding the most severe finding come first; findings within an area arrive sorted by
// severity, so the first one is the area's worst.
export function orderAreas(findingsByArea: Record<string, HealthFinding[]>): string[] {
    const worst = (area: string) => SEVERITIES.indexOf(findingsByArea[area][0].severity);
    return Object.keys(findingsByArea).sort((a, b) =>
        (worst(a) - worst(b)) || (areaRank(a) - areaRank(b)) || a.localeCompare(b),
    );
}
