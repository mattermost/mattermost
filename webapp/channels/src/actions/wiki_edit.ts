// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Post} from '@mattermost/types/posts';

import {savePageDraft} from 'actions/page_drafts';
import {getWikiUrl, getTeamNameFromPath} from 'utils/url';

import type {ActionFuncAsync} from 'mattermost-redux/types/actions';

/**
 * Opens a page in edit mode by creating a draft and navigating to it
 */
export function openPageInEditMode(
    channelId: string,
    wikiId: string,
    page: Post,
    history: any,
    location: any,
): ActionFuncAsync {
    return async (dispatch) => {
        const pageId = page.id;
        const pageTitle = (page.props?.title as string | undefined) || 'Untitled page';
        const pageParentId = page.page_parent_id;
        const pageStatusFromProps = page.props?.page_status as string | undefined;

        const additionalProps: Record<string, any> = {};
        if (pageParentId) {
            additionalProps.page_parent_id = pageParentId;
        }
        if (pageStatusFromProps) {
            additionalProps.page_status = pageStatusFromProps;
        }

        const result = await dispatch(savePageDraft(
            channelId,
            wikiId,
            pageId,
            page.message,
            pageTitle,
            pageId,
            Object.keys(additionalProps).length > 0 ? additionalProps : undefined,
        ));

        // Only navigate if draft was saved successfully
        if (result.data) {
            // Use the utility function to build the correct draft URL
            const teamName = getTeamNameFromPath(location.pathname);
            const draftPath = getWikiUrl(teamName, channelId, wikiId, pageId, true);
            history.replace(draftPath);
        }

        return {data: true};
    };
}
