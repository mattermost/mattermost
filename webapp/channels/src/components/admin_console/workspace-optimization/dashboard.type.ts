// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type DataModel = {
    [key: string]: {
        title: string;
        description: string;
        descriptionOk: string;
        items: ItemModel[];
        icon: React.ReactNode;
        hide?: boolean;
    };
}

// this conflicts with another type in consts. The only diff is it uses "SUCCESS = 'success'" instead of "OK = 'ok'"
export enum ItemStatus {
    NONE = 'none',
    OK = 'ok',
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

export type ItemModel = {
    id: string;
    title: string;
    description: string;
    status: ItemStatus;
    scoreImpact: number;
    impactModifier: number;
    configUrl?: string;
    configText?: string;
    telemetryAction?: string;
    infoUrl?: string;
    infoText?: string;
}

export type UpdatesParam = {
    serverVersion: {
        type: string;
        status: ItemStatus;
        description: string;
    };
}
