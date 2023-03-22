// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * - `null` - explicitly Channels
 * - `string` - uuid - any other product
 */
export type ProductIdentifier = null | string;

/** @see {@link ProductIdentifier} */
export type ProductScope = ProductIdentifier | ProductIdentifier[];
