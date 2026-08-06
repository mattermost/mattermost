// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MarketplacePlugin} from '@mattermost/types/marketplace';

export function getName(item: MarketplacePlugin): string {
    return item.manifest.name;
}
