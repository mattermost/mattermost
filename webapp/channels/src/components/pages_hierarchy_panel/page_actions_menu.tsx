// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import BookmarkOutlineIcon from '@mattermost/compass-icons/components/bookmark-outline';
import ClockOutlineIcon from '@mattermost/compass-icons/components/clock-outline';
import ContentCopyIcon from '@mattermost/compass-icons/components/content-copy';
import FilePdfOutlineIcon from '@mattermost/compass-icons/components/file-pdf-outline';
import FolderMoveOutlineIcon from '@mattermost/compass-icons/components/folder-move-outline';
import FormatListBulletedIcon from '@mattermost/compass-icons/components/format-list-bulleted';
import LinkVariantIcon from '@mattermost/compass-icons/components/link-variant';
import OpenInNewIcon from '@mattermost/compass-icons/components/open-in-new';
import PencilOutlineIcon from '@mattermost/compass-icons/components/pencil-outline';
import PlusIcon from '@mattermost/compass-icons/components/plus';
import TrashCanOutlineIcon from '@mattermost/compass-icons/components/trash-can-outline';

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
    canDuplicate?: boolean;
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
    canDuplicate = true,
    pageLink,
    buttonClassName = 'PagePane__icon-button btn btn-icon btn-sm',
    buttonLabel,
    buttonTestId = 'page-actions-menu-button',
}: Props) => {
    const {formatMessage} = useIntl();
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

    const moreActionsLabel = buttonLabel || formatMessage({id: 'page_actions_menu.more_actions', defaultMessage: 'More actions'});
    const newSubpageLabel = formatMessage({id: 'page_actions_menu.new_subpage', defaultMessage: 'New subpage'});
    const showOutlineLabel = formatMessage({id: 'page_actions_menu.show_outline', defaultMessage: 'Show outline'});
    const hideOutlineLabel = formatMessage({id: 'page_actions_menu.hide_outline', defaultMessage: 'Hide outline'});
    const renameLabel = formatMessage({id: 'page_actions_menu.rename', defaultMessage: 'Rename'});
    const copyLinkLabel = formatMessage({id: 'page_actions_menu.copy_link', defaultMessage: 'Copy link'});
    const moveToLabel = formatMessage({id: 'page_actions_menu.move_to', defaultMessage: 'Move to...'});
    const bookmarkInChannelLabel = formatMessage({id: 'page_actions_menu.bookmark_in_channel', defaultMessage: 'Bookmark in channel...'});
    const duplicatePageLabel = formatMessage({id: 'page_actions_menu.duplicate_page', defaultMessage: 'Duplicate page'});
    const exportToPdfLabel = formatMessage({id: 'page_actions_menu.export_to_pdf', defaultMessage: 'Export to PDF'});
    const versionHistoryLabel = formatMessage({id: 'page_actions_menu.version_history', defaultMessage: 'Version history'});
    const deletePageLabel = formatMessage({id: 'page_actions_menu.delete_page', defaultMessage: 'Delete page'});
    const deleteDraftLabel = formatMessage({id: 'page_actions_menu.delete_draft', defaultMessage: 'Delete draft'});
    const openInNewWindowLabel = formatMessage({id: 'page_actions_menu.open_in_new_window', defaultMessage: 'Open in new window'});
    const pageActionsAriaLabel = formatMessage({id: 'page_actions_menu.aria_label', defaultMessage: 'Page actions'});

    return (
        <Menu.Container
            menuButton={{
                id: `page-actions-menu-button-${pageId}`,
                dataTestId: buttonTestId,
                class: buttonClassName,
                'aria-label': moreActionsLabel,
                children: <i className='icon icon-dots-horizontal'/>,
            }}
            menu={{
                id: `page-actions-menu-${pageId}`,
                'aria-label': pageActionsAriaLabel,
                width: '216px',
            }}
            menuButtonTooltip={{
                text: moreActionsLabel,
            }}
        >
            <Menu.Item
                id='page-menu-new-child'
                data-testid='page-context-menu-new-child'
                leadingElement={<PlusIcon size={18}/>}
                labels={<span>{newSubpageLabel}</span>}
                onClick={onCreateChild}
            />
            <Menu.Separator/>
            <Menu.Item
                id='page-menu-show-outline'
                data-testid='page-context-menu-show-outline'
                leadingElement={<FormatListBulletedIcon size={18}/>}
                labels={<span>{isOutlineVisible ? hideOutlineLabel : showOutlineLabel}</span>}
                onClick={handleShowOutline}
            />
            <Menu.Item
                id='page-menu-rename'
                data-testid='page-context-menu-rename'
                leadingElement={<PencilOutlineIcon size={18}/>}
                labels={<span>{renameLabel}</span>}
                onClick={onRename}
            />
            <Menu.Item
                id='page-menu-copy-link'
                data-testid='page-context-menu-copy-link'
                leadingElement={<LinkVariantIcon size={18}/>}
                labels={<span>{copyLinkLabel}</span>}
                onClick={handleCopyLink}
            />
            <Menu.Item
                id='page-menu-move'
                data-testid='page-context-menu-move'
                leadingElement={<FolderMoveOutlineIcon size={18}/>}
                labels={<span>{moveToLabel}</span>}
                onClick={onMove}
            />
            {!isDraft && (
                <Menu.Item
                    id='page-menu-bookmark'
                    data-testid='page-context-menu-bookmark-in-channel'
                    leadingElement={<BookmarkOutlineIcon size={18}/>}
                    labels={<span>{bookmarkInChannelLabel}</span>}
                    onClick={onBookmarkInChannel}
                />
            )}
            {canDuplicate && (
                <Menu.Item
                    id='page-menu-duplicate'
                    data-testid='page-context-menu-duplicate'
                    leadingElement={<ContentCopyIcon size={18}/>}
                    labels={<span>{duplicatePageLabel}</span>}
                    onClick={onDuplicate}
                />
            )}
            <Menu.Item
                id='page-menu-export-pdf'
                data-testid='page-context-menu-export-pdf'
                leadingElement={<FilePdfOutlineIcon size={18}/>}
                labels={<span>{exportToPdfLabel}</span>}
                onClick={handleExportPDF}
            />
            <Menu.Separator/>
            {!isDraft && (
                <Menu.Item
                    id='page-menu-version-history'
                    data-testid='page-context-menu-version-history'
                    leadingElement={<ClockOutlineIcon size={18}/>}
                    labels={<span>{versionHistoryLabel}</span>}
                    onClick={onVersionHistory}
                />
            )}
            <Menu.Item
                id='page-menu-delete'
                data-testid='page-context-menu-delete'
                leadingElement={<TrashCanOutlineIcon size={18}/>}
                labels={<span>{isDraft ? deleteDraftLabel : deletePageLabel}</span>}
                onClick={onDelete}
                isDestructive={true}
            />
            <Menu.Separator/>
            <Menu.Item
                id='page-menu-open-new-window'
                data-testid='page-context-menu-open-new-window'
                leadingElement={<OpenInNewIcon size={18}/>}
                labels={<span>{openInNewWindowLabel}</span>}
                onClick={handleOpenInNewWindow}
            />
        </Menu.Container>
    );
};

export default PageActionsMenu;
