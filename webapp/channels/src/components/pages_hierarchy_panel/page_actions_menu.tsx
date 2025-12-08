// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {
    BookmarkOutlineIcon,
    ClockOutlineIcon,
    ContentCopyIcon,
    FilePdfOutlineIcon,
    FolderMoveOutlineIcon,
    FormatListBulletedIcon,
    LinkVariantIcon,
    OpenInNewIcon,
    PencilOutlineIcon,
    PlusIcon,
    TrashCanOutlineIcon,
} from '@mattermost/compass-icons/components';

import {togglePageOutline} from 'actions/views/pages_hierarchy';

import * as Menu from 'components/menu';

import {getSiteURL} from 'utils/url';
import {copyToClipboard} from 'utils/utils';

import type {GlobalState} from 'types/store';

type Props = {
    pageId: string;
    wikiId?: string;
    onCreateChild?: () => void;
    onRename?: () => void;
    onDuplicate?: () => void;
    onMove?: () => void;
    onBookmarkInChannel?: () => void;
    onDelete?: () => void;
    onVersionHistory?: () => void;
    isDraft?: boolean;
    pageLink?: string;
    buttonClassName?: string;
    buttonLabel?: string;
    buttonTestId?: string;
};

const PageActionsMenu = ({
    pageId,
    wikiId,
    onCreateChild,
    onRename,
    onDuplicate,
    onMove,
    onBookmarkInChannel,
    onDelete,
    onVersionHistory,
    isDraft = false,
    pageLink,
    buttonClassName = 'PagePane__icon-button btn btn-icon btn-sm',
    buttonLabel = 'More actions',
    buttonTestId = 'page-actions-menu-button',
}: Props) => {
    const dispatch = useDispatch();

    const isOutlineVisible = useSelector((state: GlobalState) =>
        state.views.pagesHierarchy.outlineExpandedNodes[pageId] || false,
    );

    const handleShowOutline = useCallback(() => {
        dispatch(togglePageOutline(pageId, undefined, wikiId));
    }, [dispatch, pageId, wikiId]);

    const handleCopyLink = useCallback(() => {
        if (pageLink && pageLink !== '#') {
            const siteURL = getSiteURL();
            const fullUrl = `${siteURL}${pageLink}`;
            copyToClipboard(fullUrl);
        }
    }, [pageLink]);

    const handleOpenInNewWindow = useCallback(() => {
        if (pageLink && pageLink !== '#') {
            const siteURL = getSiteURL();
            const fullUrl = `${siteURL}${pageLink}`;
            window.open(fullUrl, '_blank', 'noopener,noreferrer');
        }
    }, [pageLink]);

    const handleExportPDF = useCallback(() => {
        window.print();
    }, []);

    return (
        <Menu.Container
            menuButton={{
                id: `page-actions-menu-button-${pageId}`,
                dataTestId: buttonTestId,
                class: buttonClassName,
                'aria-label': buttonLabel,
                children: <i className='icon icon-dots-horizontal'/>,
            }}
            menu={{
                id: `page-actions-menu-${pageId}`,
                'aria-label': 'Page actions',
                width: '216px',
            }}
            menuButtonTooltip={{
                text: buttonLabel,
            }}
        >
            <Menu.Item
                id='page-menu-new-child'
                data-testid='page-context-menu-new-child'
                leadingElement={<PlusIcon size={18}/>}
                labels={<span>{'New subpage'}</span>}
                onClick={onCreateChild}
            />
            <Menu.Separator/>
            <Menu.Item
                id='page-menu-show-outline'
                data-testid='page-context-menu-show-outline'
                leadingElement={<FormatListBulletedIcon size={18}/>}
                labels={<span>{isOutlineVisible ? 'Hide outline' : 'Show outline'}</span>}
                onClick={handleShowOutline}
            />
            <Menu.Item
                id='page-menu-rename'
                data-testid='page-context-menu-rename'
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={<span>{'Rename'}</span>}
                onClick={onRename}
            />
            <Menu.Item
                id='page-menu-copy-link'
                data-testid='page-context-menu-copy-link'
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{'Copy link'}</span>}
                onClick={handleCopyLink}
            />
            <Menu.Item
                id='page-menu-move'
                data-testid='page-context-menu-move'
                leadingElement={<FolderMoveOutlineIcon size={18}/>}
                labels={<span>{'Move to...'}</span>}
                onClick={onMove}
            />
            {!isDraft && (
                <Menu.Item
                    id='page-menu-bookmark'
                    data-testid='page-context-menu-bookmark-in-channel'
                    leadingElement={<BookmarkOutlineIcon size={18}/>}
                    labels={<span>{'Bookmark in channel...'}</span>}
                    onClick={onBookmarkInChannel}
                />
            )}
            <Menu.Item
                id='page-menu-duplicate'
                data-testid='page-context-menu-duplicate'
                leadingElement={<ContentCopyIcon size={18}/>}
                labels={<span>{'Duplicate page'}</span>}
                onClick={onDuplicate}
            />
            <Menu.Item
                id='page-menu-export-pdf'
                data-testid='page-context-menu-export-pdf'
                leadingElement={<FilePdfOutlineIcon size={18}/>}
                labels={<span>{'Export to PDF'}</span>}
                onClick={handleExportPDF}
            />
            <Menu.Separator/>
            {!isDraft && (
                <Menu.Item
                    id='page-menu-version-history'
                    data-testid='page-context-menu-version-history'
                    leadingElement={<ClockOutlineIcon size={18}/>}
                    labels={<span>{'Version history'}</span>}
                    onClick={onVersionHistory}
                />
            )}
            <Menu.Item
                id='page-menu-delete'
                data-testid='page-context-menu-delete'
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={<span>{isDraft ? 'Delete draft' : 'Delete page'}</span>}
                onClick={onDelete}
                isDestructive={true}
            />
            <Menu.Separator/>
            <Menu.Item
                id='page-menu-open-new-window'
                data-testid='page-context-menu-open-new-window'
                leadingElement={<OpenInNewIcon size={18}/>}
                labels={<span>{'Open in new window'}</span>}
                onClick={handleOpenInNewWindow}
            />
        </Menu.Container>
    );
};

export default PageActionsMenu;
