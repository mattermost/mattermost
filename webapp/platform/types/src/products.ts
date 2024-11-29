// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isArrayOf} from './utilities';

/**
 * - `null` - explicitly Channels
 * - `string` - uuid - any other product
 */
export type ProductIdentifier = null | string;

/** @see {@link ProductIdentifier} */
export type ProductScope = ProductIdentifier | ProductIdentifier[];

export function isProductScope(v: unknown): v is ProductScope {
    if (v === null || typeof v === 'string') {
        return true;
    }

    return isArrayOf(v, (e) => e === null || typeof v === 'string');
}
