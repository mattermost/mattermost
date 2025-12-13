// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from '@mattermost/client';
import {Post} from '@mattermost/types/posts';

import {getRandomId} from '@/util';

type PageContent = {
    type: 'doc';
    content: Array<{
        type: string;
        content?: Array<{type: string; text: string}>;
    }>;
};

export async function createPageViaDraft(
    client: Client4,
    wikiId: string,
    title: string,
    content: PageContent,
    pageParentId = '',
): Promise<Post> {
    const draftId = await getRandomId();
    const draftContent = JSON.stringify(content);

    await client.savePageDraft(wikiId, draftId, draftContent, title);
    const page = await client.publishPageDraft(wikiId, draftId, pageParentId, title, '', draftContent);

    return page;
}
