// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ClassificationLevel = {
    id: string;
    name: string;
    color: string;
};

export type ClassificationPreset = {
    id: string;
    label: string;
    levels: ClassificationLevel[];
};

export const PRESET_CUSTOM = 'custom';

export const presets: ClassificationPreset[] = [
    {
        id: 'us',
        label: 'United States',
        levels: [
            {id: '', name: 'UNCLASSIFIED', color: '#007A33'},
            {id: '', name: 'CUI', color: '#502B85'},
            {id: '', name: 'CONFIDENTIAL', color: '#0033A0'},
            {id: '', name: 'SECRET', color: '#C8102E'},
            {id: '', name: 'TOP SECRET', color: '#FF8C00'},
        ],
    },
    {
        id: 'nato',
        label: 'NATO',
        levels: [
            {id: '', name: 'NATO UNCLASSIFIED', color: '#007A33'},
            {id: '', name: 'NATO RESTRICTED', color: '#FF671F'},
            {id: '', name: 'NATO CONFIDENTIAL', color: '#0033A0'},
            {id: '', name: 'NATO SECRET', color: '#C8102E'},
            {id: '', name: 'COSMIC TOP SECRET', color: '#F7EA48'},
        ],
    },
    {
        id: 'uk',
        label: 'UK (GSCP)',
        levels: [
            {id: '', name: 'OFFICIAL', color: '#2B71C7'},
            {id: '', name: 'OFFICIAL-SENSITIVE', color: '#2B71C7'},
            {id: '', name: 'SECRET', color: '#F39C2C'},
            {id: '', name: 'TOP SECRET', color: '#AA0000'},
        ],
    },
    {
        id: 'canada',
        label: 'Canada',
        levels: [
            {id: '', name: 'PROTECTED A', color: '#227ABC'},
            {id: '', name: 'PROTECTED B', color: '#900FB5'},
            {id: '', name: 'PROTECTED C', color: '#460FB5'},
            {id: '', name: 'CONFIDENTIAL', color: '#0033A0'},
            {id: '', name: 'SECRET', color: '#C8102E'},
            {id: '', name: 'TOP SECRET', color: '#FF671F'},
        ],
    },
    {
        id: 'australia',
        label: 'Australia (PSPF)',
        levels: [
            {id: '', name: 'UNOFFICIAL', color: '#6B7280'},
            {id: '', name: 'OFFICIAL', color: '#6B7280'},
            {id: '', name: 'OFFICIAL:Sensitive', color: '#6B7280'},
            {id: '', name: 'CONFIDENTIAL', color: '#0000FF'},
            {id: '', name: 'SECRET', color: '#FFA500'},
            {id: '', name: 'TOP SECRET', color: '#FF0000'},
        ],
    },
];
