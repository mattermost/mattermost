// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {PostMetadata, PostPriorityMetadata} from './posts';

/**
 * ServerDraft corresponds to model.Draft on the server and how draft information is sent to and from the server. It's
 * different from the PostDraft type defined in the web app which matches how drafts are stored in its state.
 */
export type ServerDraft = {
    create_at: number;
    update_at: number;
    delete_at: number;
    user_id: string;
    channel_id: string;
    root_id: string;
    message: string;
    props: Record<string, any>;
    file_ids?: string[];
    metadata?: PostMetadata;
    priority?: PostPriorityMetadata;
};
