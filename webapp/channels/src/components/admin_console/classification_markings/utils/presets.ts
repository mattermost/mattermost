// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export type ClassificationLevel = {
    id: string;
    name: string;
    color: string;
    rank: number;
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
            {id: 'uxaiwq46xffc3x5x1bwpxukw9w', name: 'UNCLASSIFIED', color: '#007A33', rank: 1},
            {id: 'fixk5qd3kid65m7enh5myccpfw', name: 'CUI', color: '#502B85', rank: 2},
            {id: 'cgomt91mij8wt8oxk9ip9xmtih', name: 'CONFIDENTIAL', color: '#0033A0', rank: 3},
            {id: 'fxca5dm5tjg9ufihgfpinc47yh', name: 'SECRET', color: '#C8102E', rank: 4},
            {id: 'wandytq84tdc7k5rq49q6mywhy', name: 'TOP SECRET', color: '#FF8C00', rank: 5},
            {id: '7q7stt4p7my3ep2w6xkqfmbnwa', name: 'TOP SECRET//SCI', color: '#FCE83A', rank: 6},
        ],
    },
    {
        id: 'uk',
        label: 'UK (GSCP)',
        levels: [
            {id: '8q3zbyu9xfre7ktckznjcdjbhh', name: 'OFFICIAL', color: '#2B71C7', rank: 1},
            {id: '3idhkzx5updcdf943dtqk7di5e', name: 'OFFICIAL-SENSITIVE', color: '#2B71C7', rank: 2},
            {id: 'pf7u934zifd1zgqeagy5fnxnye', name: 'SECRET', color: '#F39C2C', rank: 3},
            {id: '7tf4m9qe5jgxzkkk7mwm5ibzoc', name: 'TOP SECRET', color: '#AA0000', rank: 4},
        ],
    },
    {
        id: 'canada',
        label: 'Canada',
        levels: [
            {id: '5jy6zdfjg7ry3g9sa4mjmy59po', name: 'PROTECTED A', color: '#227ABC', rank: 1},
            {id: 'bijonwg7ktrmfkqx9biawaekpa', name: 'PROTECTED B', color: '#900FB5', rank: 2},
            {id: '8zgn1scm6pg6ux4z3igk7pgy1w', name: 'PROTECTED C', color: '#460FB5', rank: 3},
            {id: 'iqmtfhsautyopd47rrn4bjgfgw', name: 'CONFIDENTIAL', color: '#0033A0', rank: 4},
            {id: '8gtgn9cn13ns3fmixtg53qdwrc', name: 'SECRET', color: '#C8102E', rank: 5},
            {id: 'gthfsjzmnprtpmkutg1wskuajy', name: 'TOP SECRET', color: '#FF671F', rank: 6},
        ],
    },
    {
        id: 'australia',
        label: 'Australia (PSPF)',
        levels: [
            {id: 'f9ep3h5pai883gpibzmh69414a', name: 'UNOFFICIAL', color: '#FFFFFF', rank: 1},
            {id: 'kzjso9tq1bgyxrzgwcfedco6xw', name: 'OFFICIAL', color: '#D5D7D8', rank: 2},
            {id: 'nk3gy1fryfd67bc4go81gyhejh', name: 'OFFICIAL:Sensitive', color: '#FFEA00', rank: 3},
            {id: '3niq6ez9b7r13remwkqarkq5qc', name: 'PROTECTED', color: '#4676B6', rank: 4},
            {id: 'pwign3di7f84pfsi9zoa8cw5ko', name: 'SECRET', color: '#E2AFAE', rank: 5},
            {id: 'wridu7pp9fdqzmy3dcqk6nzesr', name: 'TOP SECRET', color: '#E1211D', rank: 6},
        ],
    },
    {
        id: 'nato',
        label: 'NATO',
        levels: [
            {id: 'iafbimm1w3razndyr6d5zckd8w', name: 'NATO UNCLASSIFIED', color: '#007A33', rank: 1},
            {id: 'kc3t8egt5if19m6zdeidui9rfw', name: 'NATO RESTRICTED', color: '#FF671F', rank: 2},
            {id: '7sagzm4u1fgczp31ppju6xk3gy', name: 'NATO CONFIDENTIAL', color: '#0033A0', rank: 3},
            {id: 'pk45zxegtjyy3bgnqwy4uq5i4a', name: 'NATO SECRET', color: '#C8102E', rank: 4},
            {id: 'brqmooby6frpdfikkr8pgo19jc', name: 'COSMIC TOP SECRET', color: '#F7EA48', rank: 5},
        ],
    },
];
