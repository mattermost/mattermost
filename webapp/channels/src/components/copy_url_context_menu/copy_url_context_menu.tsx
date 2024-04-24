// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useCallback} from 'react';
import {ContextMenu, ContextMenuTrigger, MenuItem} from 'react-contextmenu';
import {FormattedMessage} from 'react-intl';

type Props = {

    /**
     * The child component that will be right-clicked on to show the context menu
     */
    children: React.ReactNode;

    /**
     * The link to copy to the user's clipboard when the 'Copy' option is selected from the context menu
     */
    link: string;

    /**
     * A unique id differentiating this instance of context menu from others on the page
     */
    menuId: string;

    siteURL?: string;

    actions: {
        copyToClipboard: (link: string) => void;
    };
}

const CopyUrlContextMenu = ({
    link,
    siteURL,
    actions,
    menuId,
    children,
}: Props) => {
    const copy = useCallback(() => {
        let siteLink = link;

        // Transform relative links to absolute ones for copy and paste.
        if (siteLink.indexOf('http://') === -1 && siteLink.indexOf('https://') === -1) {
            siteLink = siteURL + link;
        }

        actions.copyToClipboard(siteLink);
    }, [actions, link, siteURL]);

    const contextMenu = (
        <ContextMenu id={`copy-url-context-menu${menuId}`}>
            <MenuItem
                onClick={copy}
            >
                <FormattedMessage
                    id='copy_url_context_menu.getChannelLink'
                    defaultMessage='Copy Link'
                />
            </MenuItem>
        </ContextMenu>
    );

    const contextMenuTrigger = (
        <ContextMenuTrigger
            id={`copy-url-context-menu${menuId}`}
            holdToDisplay={-1}
        >
            {children}
        </ContextMenuTrigger>
    );

    return (
        <span>
            {contextMenu}
            {contextMenuTrigger}
        </span>
    );
};

export default memo(CopyUrlContextMenu);
