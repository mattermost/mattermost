// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PropertyField, PropertyFieldOption} from './properties';

// Boards' option-chip color palette. The token names are the canonical
// on-the-wire values; hex values + i18n labels are presentation-only and
// live in `webapp/channels/src/utils/board_property_colors`.
export const BOARDS_COLOR_TOKEN_NAMES = ['default', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'] as const;
export type BoardsColorToken = typeof BOARDS_COLOR_TOKEN_NAMES[number];

export type BoardsPropertyFieldGroupID = 'boards';

export type BoardsPropertyField = PropertyField & {
    group_id: BoardsPropertyFieldGroupID;
    object_type: 'post';
    attrs: {
        sort_order: number;
        options?: Array<PropertyFieldOption<BoardsColorToken>>;
    };
};

export type BoardsPropertyFieldPatch = Partial<Pick<BoardsPropertyField, 'name' | 'attrs' | 'type'>>;
