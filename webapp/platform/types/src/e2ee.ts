// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export interface E2EEVersionInfo {
    version: string;
    build: string;
    e2ee_enabled: boolean;
}

export interface E2EEDevice {
    device_id: string;
    user_id: string;
    signature_public_key: string; // base64
    device_name?: string;
    created_at: number;
    last_active_at: number;
    revoke_at?: number;
}
