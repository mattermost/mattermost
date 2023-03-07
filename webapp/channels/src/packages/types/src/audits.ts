// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type Audit = {
    id: string;
    create_at: number;
    user_id: string;
    action: string;
    extra_info: string;
    ip_address: string;
    session_id: string;
}
