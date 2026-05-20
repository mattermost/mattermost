// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {z} from 'zod';

const FileInfoSchema = z.object({
    id: z.string(),
    user_id: z.string(),
    channel_id: z.string(),
    create_at: z.number().int(),
    update_at: z.number().int(),
    delete_at: z.number().int(),
    name: z.string(),
    extension: z.string(),
    size: z.number().int(),
    mime_type: z.string(),
    mini_preview: z.nullable(z.any()),
    remote_id: z.string(),
    archived: z.boolean(),
});

export const FileUploadResponseSchema = z.object({
    file_infos: z.array(FileInfoSchema),
    client_ids: z.array(z.string()),
});
