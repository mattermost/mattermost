// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Compliance = {
    id: string;
    create_at: number;
    user_id: string;
    status: string;
    count: number;
    desc: string;
    type: string;
    start_at: number;
    end_at: number;
    keywords: string;
    emails: string;
};
