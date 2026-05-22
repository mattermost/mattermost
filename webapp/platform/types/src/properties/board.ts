// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from './system';

// Boards' option-chip color palette. The token names are the canonical
// on-the-wire values; hex values + i18n labels are presentation-only and
// live in `webapp/channels/src/utils/board_property_colors`.
export const COLOR_TOKEN_NAMES = ['default', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
export type ColorToken = typeof COLOR_TOKEN_NAMES[number];

export type BoardPropertyFieldGroupID = 'boards';

export type BoardPropertyField = PropertyField & {
    group_id: BoardPropertyFieldGroupID;
    object_type: 'post';
    attrs: {
        sort_order: number;
        options?: Array<PropertyFieldOption<ColorToken>>;
    };
};

export type BoardPropertyFieldPatch = Partial<Pick<BoardPropertyField, 'name' | 'attrs' | 'type'>>;
