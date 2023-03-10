// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ClientConfig = {
    telemetry: boolean
    telemetryid: string
    enablePublicSharedBoards: boolean
    featureFlags: Record<string, string>
    teammateNameDisplay: string
    maxFileSize: number
}
