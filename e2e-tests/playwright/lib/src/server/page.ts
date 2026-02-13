// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {Post} from '@mattermost/types/posts';

type PageContent = {
    type: 'doc';
    content: Array<{
        type: string;
        attrs?: Record<string, unknown>;
        content?: Array<{type: string; text?: string; content?: unknown[]}>;
    }>;
};

export async function createPageViaDraft(
    client: Client4,
    wikiId: string,
    title: string,
    content: PageContent,
    pageParentId = '',
): Promise<Post> {
    const draftContent = JSON.stringify(content);

    // Step 1: Create a new draft (POST to /drafts)
    const draft = await client.createPageDraft(wikiId, title, pageParentId);

    // Step 2: Update the draft with content (PUT to /drafts/{draftId})
    await client.savePageDraft(wikiId, draft.page_id, draftContent, title);

    // Step 3: Publish the draft (POST to /drafts/{draftId}/publish)
    const page = await client.publishPageDraft(wikiId, draft.page_id, pageParentId, title, '', draftContent);

    return page;
}
