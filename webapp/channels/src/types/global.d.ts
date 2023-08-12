// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

declare const COMMIT_HASH: string;
declare interface Error {
    name: string;
    message: string;
    stack?: string;
    server_error_id?: string;
}
