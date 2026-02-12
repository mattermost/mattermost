// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useContext} from 'react';

import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';

import * as Menu from 'components/menu';
import {MenuContext} from 'components/menu/menu_context';

import {useBookmarkLink} from './bookmark_item_content';

interface OverflowBookmarkItemProps {
    id: string;
    bookmark: ChannelBookmark;
    [key: string]: unknown;
}

function OverflowBookmarkItem({id, bookmark, ...otherProps}: OverflowBookmarkItemProps) {
    const menuContext = useContext(MenuContext);
    const handleNavigate = useCallback(() => {
        menuContext.close?.();
    }, [menuContext]);

    const {open, icon} = useBookmarkLink(bookmark, false, handleNavigate);

    return (
        <Menu.Item
            id={`overflow-bookmark-${id}`}
            data-testid={`overflow-bookmark-item-${id}`}
            onClick={open}
            leadingElement={icon}
            labels={<span>{bookmark.display_name}</span>}
            {...otherProps}
        />
    );
}

export default OverflowBookmarkItem;
