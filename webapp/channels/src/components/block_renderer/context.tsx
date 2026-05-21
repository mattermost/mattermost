// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {createContext} from 'react';

import type {PostImage} from '@mattermost/types/posts';

export const MmBlocksImagesMetadataContext = createContext<Record<string, PostImage> | undefined>(undefined);

/** How the *immediate* mm_blocks parent lays out direct children (`column` = vertical stack, `row` = horizontal flow). */
export const MmBlocksChildLayoutContext = createContext<'column' | 'row'>('column');
