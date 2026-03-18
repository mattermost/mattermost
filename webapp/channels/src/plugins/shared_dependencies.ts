// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Every module exported from the @mattermost/shared package must be added to this map
const sharedDependencies = new Map([
    ['@mattermost/shared/components/emoji', () => import('@mattermost/shared/components/emoji')],
]);

export function loadSharedDependency(request: string) {
    const loader = sharedDependencies.get(request);
    if (loader) {
        return loader();
    }

    throw new Error(`A plugin attempted to load ${request} which couldn't be found.`);
}
