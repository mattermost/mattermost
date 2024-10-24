// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type PluginStatus = {
    state: number;
    error?: string;
    active: boolean;
    id: string;
    description: string;
    version: string;
    name: string;
    instances: any[];
    settings_schema?: {
        header: string;
        footer: string;
        settings?: unknown[];
    };
}

type PluginSettingsModalProps = {
    show: boolean;
    onConfirm: (checked: boolean) => void;
    onCancel: (checked: boolean) => void;
}
