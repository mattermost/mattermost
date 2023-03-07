// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const BoardTypeOpen = 'O';
const BoardTypePrivate = 'P';
const boardTypes = [BoardTypeOpen, BoardTypePrivate];
type BoardTypes = typeof boardTypes[number];

type PropertyTypeEnum = 'text' | 'number' | 'select' | 'multiSelect' | 'date' | 'person' | 'file' | 'checkbox' | 'url' | 'email' | 'phone' | 'createdTime' | 'createdBy' | 'updatedTime' | 'updatedBy' | 'unknown';

interface IPropertyOption {
    id: string;
    value: string;
    color: string;
}

// A template for card properties attached to a board
interface IPropertyTemplate {
    id: string;
    name: string;
    type: PropertyTypeEnum;
    options: IPropertyOption[];
}
export declare type Board = {
    id: string;
    teamId: string;
    channelId?: string;
    createdBy: string;
    modifiedBy: string;
    type: BoardTypes;
    minimumRole: string;

    title: string;
    description: string;
    icon?: string;
    showDescription: boolean;
    isTemplate: boolean;
    templateVersion: number;
    properties: Record<string, string | string[]>;
    cardProperties: IPropertyTemplate[];

    createAt: number;
    updateAt: number;
    deleteAt: number;
}

export declare type CreateBoardResponse = {
    boards: Board[];
}
