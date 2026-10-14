// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AccessControlPolicy} from '@mattermost/types/access_control';
import type {UserPropertyField} from '@mattermost/types/properties_user';

import {
    findMatchingParen,
    getSyncedAttributeReferences,
    getTableEditorValue,
    hasBalancedParens,
    isBotScopeExpression,
    isBotScopePolicy,
    isMaskingFailureExpression,
    referencedUserAttributeNames,
    unwrapBotExpression,
    wrapBotExpression,
} from './bot_scope';

const makeField = (name: string, attrs: Partial<UserPropertyField['attrs']> = {}): UserPropertyField => ({
    id: `id-${name}`,
    name,
    type: 'text',
    group_id: 'custom_profile_attributes',
    target_id: '',
    target_type: '',
    object_type: 'user',
    attrs: {
        sort_order: 0,
        visibility: 'always',
        value_type: '',
        ...attrs,
    },
    create_at: 0,
    update_at: 0,
    delete_at: 0,
    created_by: '',
    updated_by: '',
});

const policy = (roles: string[] | undefined, expressions: string[]): Pick<AccessControlPolicy, 'roles' | 'rules'> => ({
    roles,
    rules: expressions.map((expression) => ({actions: ['upload_file_attachment'], expression})),
});

const SERIALIZER_CASES: Array<{name: string; returned: string; unwrapped: string}> = [
    {
        name: 'a masking on GET',
        returned: '!user.isbot || user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"',
        unwrapped: 'user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"',
    },
    {
        name: 'a masking on search',
        returned: '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Public" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Restricted"',
        unwrapped: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Public" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Restricted"',
    },
    {
        name: 'b masking on GET',
        returned: '!user.isbot || user.attributes.Clearance == "Secret" || user.attributes.Program == "Dragon" ||\nuser.attributes.Clearance == "TopSecret" || user.attributes.Program == "Phoenix" ||\nuser.attributes.Clearance == "Restricted"',
        unwrapped: 'user.attributes.Clearance == "Secret" || user.attributes.Program == "Dragon" ||\nuser.attributes.Clearance == "TopSecret" || user.attributes.Program == "Phoenix" ||\nuser.attributes.Clearance == "Restricted"',
    },
    {
        name: 'b masking on search',
        returned: '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Phoenix" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Restricted"',
        unwrapped: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Phoenix" ||\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Restricted"',
    },
    {
        name: 'c masking on GET',
        returned: '!user.isbot || ((user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra"))',
        unwrapped: '(user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra")',
    },
    {
        name: 'c masking on search',
        returned: '!user.isbot || ((user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon") ? (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix") : (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Hydra"))',
        unwrapped: '(user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon") ? (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix") : (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Hydra")',
    },
    {
        name: 'd1 masking on GET',
        returned: '!user.isbot || "a" in user.attributes.Tags || "b" in user.attributes.Tags',
        unwrapped: '"a" in user.attributes.Tags || "b" in user.attributes.Tags',
    },
    {
        name: 'd1 masking on search',
        returned: '!user.isbot || "a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo',
        unwrapped: '"a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo',
    },
    {
        name: 'd2 masking on GET',
        returned: '!user.isbot || ("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
        unwrapped: '("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
    },
    {
        name: 'd2 masking on search',
        returned: '!user.isbot || ("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
        unwrapped: '("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
    },
    {
        name: 'd3 masking on GET',
        returned: '!user.isbot || ("a" in user.attributes.Tags || "b" in user.attributes.Tags || "c" in user.attributes.Tags ||\n"d" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
        unwrapped: '("a" in user.attributes.Tags || "b" in user.attributes.Tags || "c" in user.attributes.Tags ||\n"d" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
    },
    {
        name: 'd3 masking on search',
        returned: '!user.isbot || ("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "c" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"d" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
        unwrapped: '("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "c" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo ||\n"d" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
    },
    {
        name: 'e masking on GET',
        returned: '!user.isbot || user.attributes.Program in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
        unwrapped: 'user.attributes.Program in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
    },
    {
        name: 'e masking on search',
        returned: '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
        unwrapped: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
    },
    {
        name: 'a masking off GET',
        returned: '!user.isbot || user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" && user.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" && user.attributes.Clearance != "Restricted"',
        unwrapped: 'user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" && user.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" && user.attributes.Clearance != "Restricted"',
    },
    {
        name: 'a masking off search',
        returned: '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Public" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Restricted"',
        unwrapped: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Public" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Restricted"',
    },
    {
        name: 'b masking off GET',
        returned: '!user.isbot || user.attributes.Clearance == "Secret" || user.attributes.Program == "Dragon" || user.attributes.Clearance == "TopSecret" || user.attributes.Program == "Phoenix" || user.attributes.Clearance == "Restricted"',
        unwrapped: 'user.attributes.Clearance == "Secret" || user.attributes.Program == "Dragon" || user.attributes.Clearance == "TopSecret" || user.attributes.Program == "Phoenix" || user.attributes.Clearance == "Restricted"',
    },
    {
        name: 'b masking off search',
        returned: '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Phoenix" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Restricted"',
        unwrapped: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Phoenix" || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Restricted"',
    },
    {
        name: 'c masking off GET',
        returned: '!user.isbot || ((user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" && user.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" && user.attributes.Program == "Hydra"))',
        unwrapped: '(user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" && user.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" && user.attributes.Program == "Hydra")',
    },
    {
        name: 'c masking off search',
        returned: '!user.isbot || ((user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon") ? (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix") : (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Hydra"))',
        unwrapped: '(user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon") ? (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix") : (user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "TopSecret" && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Hydra")',
    },
    {
        name: 'd1 masking off GET',
        returned: '!user.isbot || "a" in user.attributes.Tags || "b" in user.attributes.Tags',
        unwrapped: '"a" in user.attributes.Tags || "b" in user.attributes.Tags',
    },
    {
        name: 'd1 masking off search',
        returned: '!user.isbot || "a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo',
        unwrapped: '"a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo',
    },
    {
        name: 'd2 masking off GET',
        returned: '!user.isbot || ("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
        unwrapped: '("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
    },
    {
        name: 'd2 masking off search',
        returned: '!user.isbot || ("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
        unwrapped: '("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
    },
    {
        name: 'd3 masking off GET',
        returned: '!user.isbot || ("a" in user.attributes.Tags || "b" in user.attributes.Tags || "c" in user.attributes.Tags || "d" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
        unwrapped: '("a" in user.attributes.Tags || "b" in user.attributes.Tags || "c" in user.attributes.Tags || "d" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
    },
    {
        name: 'd3 masking off search',
        returned: '!user.isbot || ("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "c" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "d" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
        unwrapped: '("a" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "b" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "c" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo || "d" in user.id_7swqffpxy7dnxyf6wipuc8grwr.id_jfzrbd6f838nzxgtx4yd5t1ppo) && user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret"',
    },
    {
        name: 'e masking off GET',
        returned: '!user.isbot || user.attributes.Program in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
        unwrapped: 'user.attributes.Program in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
    },
    {
        name: 'e masking off search',
        returned: '!user.isbot || user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
        unwrapped: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
    },
];

const fixture = (name: string) => {
    const found = SERIALIZER_CASES.find((c) => c.name === name);
    if (!found) {
        throw new Error(`missing fixture ${name}`);
    }
    return found;
};

const PROGRAM_DRAGON = 'user.attributes.Program == "Dragon"';

const BREAKOUT_TERNARY_E = 'user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret") : (user.attributes.Clearance == "Public"';
const BREAKOUT_TERNARY_RETURNED = '(!user.isbot || user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret") : (user.attributes.Clearance == "Public")';

const BREAKOUT_OR_E = 'user.attributes.Program == "Dragon") || (true';
const BREAKOUT_OR_RETURNED = '!user.isbot || user.attributes.Program == "Dragon" || true';

const COMMENT_E = 'user.attributes.Program == "Dragon" // note';
const COMMENT_SUBMITTED = '!user.isbot || (user.attributes.Program == "Dragon" // note\n)';
const COMMENT_RETURNED = '!user.isbot || user.attributes.Program == "Dragon"';

const COMMENT_SUBMITTED_NO_NEWLINE = '!user.isbot || (user.attributes.Program == "Dragon" // note)';

const MASKED_RETURNED = '!user.isbot || user.attributes.Level == "--------"';
const MASKED_MIXED_RETURNED = '!user.isbot || user.attributes.Level == "--------" && user.attributes.Program == "Dragon"';
const FIELD_DELETED_RETURNED = '!user.isbot || user.attributes.Temp == "--------"';

describe('isBotScopeExpression', () => {
    it.each(SERIALIZER_CASES)('$name is detected', ({returned}) => {
        expect(isBotScopeExpression(returned)).toBe(true);
    });

    it('detects a prefix-kept breakout, so the pre-wrap guard is load-bearing', () => {
        expect(isBotScopeExpression(BREAKOUT_OR_RETURNED)).toBe(true);
    });

    it('rejects a breakout that lost the prefix', () => {
        expect(isBotScopeExpression(BREAKOUT_TERNARY_RETURNED)).toBe(false);
    });

    it.each([
        ['masking failure', 'false'],
        ['leading whitespace', ' !user.isbot || x'],
        ['no spaces around ||', '!user.isbot||x'],
        ['plain rule', PROGRAM_DRAGON],
        ['empty', ''],
        ['bare negation', '!user.isbot'],
        ['prefix without trailing space', '!user.isbot ||'],
        ['positive isbot', 'user.isbot || x'],
    ])('rejects %s', (_, expr) => {
        expect(isBotScopeExpression(expr)).toBe(false);
    });
});

describe('unwrapBotExpression', () => {
    it.each(SERIALIZER_CASES)('$name unwraps exactly', ({returned, unwrapped}) => {
        expect(unwrapBotExpression(returned)).toBe(unwrapped);
    });

    it('keeps the ternary condition parens while stripping the enclosing pair', () => {
        const result = unwrapBotExpression(fixture('c masking on GET').returned);
        expect(result.startsWith('(user.attributes.Program == "Dragon") ? (')).toBe(true);
        expect(result).toContain('&&\nuser.attributes.Program != "Phoenix")');
    });

    it('keeps a leading group that does not enclose the whole expression', () => {
        expect(unwrapBotExpression(fixture('d2 masking on GET').returned)).toBe('("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"');
    });

    it.each([
        [MASKED_RETURNED, 'user.attributes.Level == "--------"'],
        [MASKED_MIXED_RETURNED, 'user.attributes.Level == "--------" && user.attributes.Program == "Dragon"'],
        [FIELD_DELETED_RETURNED, 'user.attributes.Temp == "--------"'],
    ])('unwraps masked placeholder %j', (input, expected) => {
        expect(unwrapBotExpression(input)).toBe(expected);
    });

    it('strips a doubled prefix', () => {
        expect(unwrapBotExpression('!user.isbot || !user.isbot || (user.attributes.Program == "Dragon"\n)')).toBe('user.attributes.Program == "Dragon"');
    });

    it('unwraps the submitted form of a commented rule', () => {
        expect(unwrapBotExpression(COMMENT_SUBMITTED)).toBe(COMMENT_E);
    });

    it.each([
        ['simple', PROGRAM_DRAGON],
        ['ternary', fixture('c masking on GET').unwrapped],
        ['leading group', fixture('d2 masking on GET').unwrapped],
        ['comment', COMMENT_E],
        ['newlines', fixture('a masking on GET').unwrapped],
        ['prefixed body', '!user.isbot || x'],
    ])('round-trips wrap of %s', (_, expr) => {
        expect(unwrapBotExpression(wrapBotExpression(expr))).toBe(expr);
    });

    it('strips every prefix from the server form of a prefixed body', () => {
        expect(unwrapBotExpression('!user.isbot || !user.isbot || x')).toBe('x');
    });

    it('unwraps the server form of a commented rule', () => {
        expect(unwrapBotExpression(COMMENT_RETURNED)).toBe(PROGRAM_DRAGON);
    });

    it('keeps parens when the first group closes early', () => {
        expect(unwrapBotExpression('!user.isbot || (user.attributes.A == "a") && (user.attributes.B == "b")')).toBe('(user.attributes.A == "a") && (user.attributes.B == "b")');
    });

    it('ignores parens inside string literals', () => {
        expect(unwrapBotExpression('!user.isbot || ("a)" in user.attributes.Tags || "b(" in user.attributes.Tags) && user.attributes.Clearance == "Secret"')).toBe('("a)" in user.attributes.Tags || "b(" in user.attributes.Tags) && user.attributes.Clearance == "Secret"');
    });

    it('ignores || and ( inside a string literal', () => {
        expect(unwrapBotExpression('!user.isbot || user.attributes.X == "a || (b"')).toBe('user.attributes.X == "a || (b"');
    });

    it('strips an enclosing pair whose body has parens in literals', () => {
        expect(unwrapBotExpression('!user.isbot || (user.attributes.X == ")" && user.attributes.Y == "(")')).toBe('user.attributes.X == ")" && user.attributes.Y == "("');
    });

    it('handles a single-quoted literal with an escaped quote', () => {
        expect(unwrapBotExpression("!user.isbot || (user.attributes.X == 'it\\'s (x'\n)")).toBe("user.attributes.X == 'it\\'s (x'");
    });

    it('returns non-prefixed input unchanged and untrimmed', () => {
        expect(unwrapBotExpression('  user.attributes.X == "a"  ')).toBe('  user.attributes.X == "a"  ');
    });

    it('returns empty input unchanged', () => {
        expect(unwrapBotExpression('')).toBe('');
    });

    it('returns an empty string for a bare prefix', () => {
        expect(unwrapBotExpression('!user.isbot || ')).toBe('');
    });

    it('returns an empty string for an empty wrapped body', () => {
        expect(unwrapBotExpression('!user.isbot || (\n)')).toBe('');
    });

    it('unwraps a prefix-kept OR breakout without hiding the || true', () => {
        expect(unwrapBotExpression(BREAKOUT_OR_RETURNED)).toBe('user.attributes.Program == "Dragon" || true');
    });

    it('strips only one enclosing pair', () => {
        expect(unwrapBotExpression('!user.isbot || ((user.attributes.A == "a"))')).toBe('(user.attributes.A == "a")');
    });

    it('does not strip an unbalanced leading paren', () => {
        expect(unwrapBotExpression('!user.isbot || (user.attributes.A == "a"')).toBe('(user.attributes.A == "a"');
    });
});

describe('wrapBotExpression', () => {
    it('wraps with prefix, parens and a trailing newline', () => {
        expect(wrapBotExpression(PROGRAM_DRAGON)).toBe('!user.isbot || (user.attributes.Program == "Dragon"\n)');
    });

    it('produces the submitted form for a commented rule', () => {
        const wrapped = wrapBotExpression(COMMENT_E);
        expect(wrapped).toBe(COMMENT_SUBMITTED);
        expect(wrapped.endsWith('// note\n)')).toBe(true);
    });

    it('never produces the newline-less form the server rejected', () => {
        expect(wrapBotExpression(COMMENT_E)).not.toBe(COMMENT_SUBMITTED_NO_NEWLINE);
    });

    it('keeps the closing paren off a trailing comment line', () => {
        expect(wrapBotExpression('P == "x" // c').endsWith('// c\n)')).toBe(true);
    });

    it('does not trim its input', () => {
        expect(wrapBotExpression('  x  ')).toBe('!user.isbot || (  x  \n)');
    });

    it('produces balanced output for balanced input', () => {
        expect(hasBalancedParens(wrapBotExpression(COMMENT_E))).toBe(true);
        expect(hasBalancedParens(wrapBotExpression(PROGRAM_DRAGON))).toBe(true);
    });
});

describe('hasBalancedParens', () => {
    it.each([
        [BREAKOUT_TERNARY_E, false],
        [BREAKOUT_OR_E, false],
        ['"unterminated', false],
        ['(x == "a"', false],
        ['x // (\n)', false],
        ['x == "a\n"', false],
        ['x == "a\r"', false],
        ["x == 'unterminated", false],
        ['x == "a\\', false],
        [')(', false],
        ['(a))', false],
        [COMMENT_E, true],
        ['x == ")"', true],
        ['x // (', true],
        [PROGRAM_DRAGON, true],
        ['x == "a\\")"', true],
        ['x == \'")\' && (y == "\'(")', true],
        ['x == "//(" && (y)', true],
        ['x // )\n', true],
        ['(a) // )', true],
        ['', true],
    ])('%j -> %s', (input, expected) => {
        expect(hasBalancedParens(input)).toBe(expected);
    });

    it.each([
        ['triple-quoted OR breakout', '"""a"b""") || (true || """c"d"""'],
        ['raw-string OR breakout', 'r"\\") || (true || \'"\\\'\''],
        ['raw-string ternary breakout', 'R"\\") ? (true) : (true || \'"\\\'\''],
        ['raw string', 'x == r"("'],
        ['triple single-quoted string', "x == '''('''"],
        ['triple-quoted string', 'x == """a"""'],
        ['bytes raw string', 'x == br"a"'],
    ])('fails closed on %s', (_, input) => {
        expect(hasBalancedParens(input)).toBe(false);
    });

    it.each([
        ['LF', 'x == "a\\\n) || (true"'],
        ['CR', 'x == "a\\\r) || (true"'],
    ])('does not let a backslash continue a literal across %s', (_, input) => {
        expect(hasBalancedParens(input)).toBe(false);
    });

    it.each(SERIALIZER_CASES)('$name returned is balanced', ({returned}) => {
        expect(hasBalancedParens(returned)).toBe(true);
    });

    it.each([
        MASKED_RETURNED,
        MASKED_MIXED_RETURNED,
        FIELD_DELETED_RETURNED,
        COMMENT_SUBMITTED,
        COMMENT_RETURNED,
        BREAKOUT_OR_RETURNED,
        BREAKOUT_TERNARY_RETURNED,
    ])('%j is balanced', (input) => {
        expect(hasBalancedParens(input)).toBe(true);
    });

    it('treats the newline-less commented wrap as unbalanced', () => {
        expect(hasBalancedParens(COMMENT_SUBMITTED_NO_NEWLINE)).toBe(false);
    });
});

describe('findMatchingParen', () => {
    it.each([
        ['(a) && (b)', 0, 2],
        ['(a) && (b)', 7, 9],
        ['(a) && (b)', 1, -1],
        ['"(" && (b)', 1, -1],
        ['"(" && (b)', 7, 9],
        ['(a', 0, -1],
        ['((a) || b)', 0, 9],
        ['((a) || b)', 1, 3],
        ['(a == ")")', 0, 9],
        ['x // (\n(y)', 5, -1],
        ['x // (\n(y)', 7, 9],
        ['(a)', -1, -1],
        ['(a)', 3, -1],
        ['', 0, -1],
    ])('findMatchingParen(%j, %i) -> %i', (s, openIdx, expected) => {
        expect(findMatchingParen(s, openIdx)).toBe(expected);
    });

    it.each([
        ['an unmatched later )', '(a)) && (b)', 0],
        ['an unmatched later )', '(a)) && (b)', 8],
        ['a later unclosed (', '(a) && (b', 0],
        ['an unterminated string', '(a) "x', 0],
        ['a raw string', '(a) && r"x"', 0],
    ])('returns -1 on input with %s', (_, s, openIdx) => {
        expect(findMatchingParen(s, openIdx)).toBe(-1);
    });
});

describe('getTableEditorValue', () => {
    it.each([
        'a masking on GET',
        'a masking off GET',
        'd2 masking on GET',
        'd3 masking on GET',
        'e masking on GET',
        'e masking off GET',
    ])('%s unwrapped is simple and returned as is', (name) => {
        const {unwrapped} = fixture(name);
        expect(getTableEditorValue(unwrapped)).toBe(unwrapped);
    });

    it.each([
        'b masking on GET',
        'b masking off GET',
        'c masking on GET',
        'c masking off GET',
    ])('%s unwrapped falls back to CEL mode', (name) => {
        expect(getTableEditorValue(fixture(name).unwrapped)).toBeNull();
    });

    it('restores the parens the server dropped around a lone has-any-of group', () => {
        const parenthesized = '("a" in user.attributes.Tags || "b" in user.attributes.Tags)';
        expect(fixture('d1 masking on GET').unwrapped).toBe('"a" in user.attributes.Tags || "b" in user.attributes.Tags');
        expect(getTableEditorValue(fixture('d1 masking on GET').unwrapped)).toBe(parenthesized);
        expect(getTableEditorValue(fixture('d1 masking off GET').unwrapped)).toBe(parenthesized);
    });

    it('returns a masked placeholder rule as is', () => {
        expect(getTableEditorValue('user.attributes.Level == "--------"')).toBe('user.attributes.Level == "--------"');
    });

    it.each(['', '   ', '\n'])('returns an empty string for blank input %j', (input) => {
        expect(getTableEditorValue(input)).toBe('');
    });

    it('returns null for an expression that is not simple even with parens', () => {
        expect(getTableEditorValue('user.attributes.A == "a" || user.attributes.B == "b"')).toBeNull();
    });
});

describe('isMaskingFailureExpression', () => {
    it.each([
        ['false', true],
        [' false\n', true],
        ['!user.isbot || false', false],
        [PROGRAM_DRAGON, false],
        ['', false],
        ['true', false],
        ['False', false],
    ])('%j -> %s', (input, expected) => {
        expect(isMaskingFailureExpression(input)).toBe(expected);
    });
});

describe('isBotScopePolicy', () => {
    it.each([
        ['zero rules', policy(['system_user'], []), false],
        ['all rules prefixed', policy(['system_user'], [SERIALIZER_CASES[0].returned, MASKED_RETURNED]), true],
        ['single prefixed rule', policy(['system_user'], [MASKED_RETURNED]), true],
        ['mixed rules', policy(['system_user'], [MASKED_RETURNED, PROGRAM_DRAGON]), false],
        ['guest role', policy(['system_guest'], [MASKED_RETURNED]), false],
        ['admin role', policy(['system_admin'], [MASKED_RETURNED]), false],
        ['missing roles', policy(undefined, [MASKED_RETURNED]), false],
        ['empty roles', policy([], [MASKED_RETURNED]), false],
        ['system_user not first', policy(['system_guest', 'system_user'], [MASKED_RETURNED]), false],
        ['masking failure replaced the prefix', policy(['system_user'], ['false']), false],
        ['prefix-lost breakout', policy(['system_user'], [BREAKOUT_TERNARY_RETURNED]), false],
    ])('%s', (_, input, expected) => {
        expect(isBotScopePolicy(input)).toBe(expected);
    });

    it('treats missing rules as not bot scoped', () => {
        expect(isBotScopePolicy({roles: ['system_user'], rules: undefined as unknown as AccessControlPolicy['rules']})).toBe(false);
    });

    it('treats a rule with a missing expression as not bot scoped', () => {
        const rules = [{actions: ['upload_file_attachment']}] as unknown as AccessControlPolicy['rules'];
        expect(isBotScopePolicy({roles: ['system_user'], rules})).toBe(false);
    });
});

describe('referencedUserAttributeNames', () => {
    it.each([
        ['user.attributes.A == "user.attributes.B"', ['A']],
        ['user.attributes.A == "x" && user.attributes.B == "y" || user.attributes.A != "z"', ['A', 'B']],
        ["user.attributes.A == 'user.attributes.C' && \"x\" in user.attributes.Tags", ['A', 'Tags']],
        ['user.email == "a@b.c" && user.session.Platform == "desktop"', []],
        ['', []],
        ['user.attributes.A == "a \\" user.attributes.B"', ['A']],
        ['user.attributes.A_1 == "x"', ['A_1']],
    ])('%j -> %j', (input, expected) => {
        expect(referencedUserAttributeNames(input)).toEqual(expected);
    });

    it('collects names from a multi-line fixture in order of first occurrence', () => {
        expect(referencedUserAttributeNames(fixture('d3 masking on GET').unwrapped)).toEqual(['Tags', 'Clearance']);
    });

    it('collects names from a ternary fixture', () => {
        expect(referencedUserAttributeNames(fixture('c masking on GET').unwrapped)).toEqual(['Program', 'Clearance']);
    });

    it('finds no names in the ID-encoded search form', () => {
        expect(referencedUserAttributeNames(fixture('a masking on search').unwrapped)).toEqual([]);
    });

    describe('comments', () => {
        it.each([
            ['a comment-only reference', 'user.attributes.A == "x" // was user.attributes.B', ['A']],
            ['a whole-line comment', '// user.attributes.B == "x"\nuser.attributes.A == "y"', ['A']],
            ['a trailing comment with no newline', 'user.attributes.A == "x" //user.attributes.B', ['A']],
            ['an apostrophe in a comment before a real reference', '// don\'t use teams\nuser.attributes.B == "x" && user.attributes.C == \'y\'', ['B', 'C']],
            ['a quote in a comment after a reference', 'user.attributes.A == "x" // the "B" one\n&& user.attributes.C == "y"', ['A', 'C']],
            ['// inside a string literal', 'user.attributes.A == "http://x" && user.attributes.B == "y"', ['A', 'B']],
            ['a comment marker inside a literal next to a reference', 'user.attributes.A.startsWith("//") && user.attributes.B == "y"', ['A', 'B']],
        ])('%s', (_label, input, expected) => {
            expect(referencedUserAttributeNames(input)).toEqual(expected);
        });
    });

    describe('bracket access', () => {
        it.each([
            ['double-quoted', 'user.attributes["teams"] == "x"', ['teams']],
            ['single-quoted', "user.attributes['teams'] == 'x'", ['teams']],
            ['with whitespace', 'user.attributes [ "Sales Region" ] == "x"', ['Sales Region']],
            ['mixed with dot access, in order and deduped', 'user.attributes.A == "x" && user.attributes["B"] == "y" && user.attributes["A"] != "z"', ['A', 'B']],
            ['inside a comment', 'user.attributes.A == "x" // user.attributes["B"]', ['A']],
            ['inside a string literal', 'user.attributes.A == "user.attributes[\'B\']"', ['A']],
            ['a non-literal index', 'user.attributes[user.attributes.A] == "x"', ['A']],
        ])('%s', (_label, input, expected) => {
            expect(referencedUserAttributeNames(input)).toEqual(expected);
        });
    });

    it('still ignores names that appear only in string literals', () => {
        expect(referencedUserAttributeNames('user.attributes.A == "user.attributes.B" && user.attributes.C in [\'user.attributes.D\']')).toEqual(['A', 'C']);
    });
});

describe('getSyncedAttributeReferences', () => {
    const clearance = makeField('Clearance', {ldap: 'clearance'});
    const program = makeField('Program', {saml: 'program'});
    const tags = makeField('Tags');
    const level = makeField('Level', {managed: 'admin'});
    const prot = makeField('Prot', {protected: true});
    const emptyLdap = makeField('EmptyLdap', {ldap: ''});
    const fields = [clearance, program, tags, level, prot, emptyLdap];

    it('ignores names that appear only inside literals', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "Secret" && user.attributes.Tags == "user.attributes.Program"', fields)).toEqual([clearance]);
    });

    it('returns LDAP and SAML fields in field order', () => {
        expect(getSyncedAttributeReferences('user.attributes.Program == "x" && user.attributes.Clearance == "y"', fields)).toEqual([clearance, program]);
    });

    it('excludes admin-managed, protected, empty-LDAP and plain fields', () => {
        expect(getSyncedAttributeReferences('user.attributes.Level == "Gold" && user.attributes.Prot == "x" && user.attributes.EmptyLdap == "z" && user.attributes.Tags == "a"', fields)).toEqual([]);
    });

    it('returns nothing for an empty expression', () => {
        expect(getSyncedAttributeReferences('', fields)).toEqual([]);
    });

    it('returns nothing when there are no fields', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "Secret"', [])).toEqual([]);
    });

    it('returns each field once even when referenced repeatedly', () => {
        expect(getSyncedAttributeReferences('user.attributes.Clearance == "a" || user.attributes.Clearance == "b"', fields)).toEqual([clearance]);
    });

    it('ignores a synced name that is only commented out', () => {
        expect(getSyncedAttributeReferences('user.attributes.Tags == "a" // was user.attributes.Clearance', fields)).toEqual([]);
    });

    it('finds a synced name after a comment with an apostrophe', () => {
        expect(getSyncedAttributeReferences('// don\'t drop this\nuser.attributes.Tags == \'a\' && user.attributes.Clearance == "b"', fields)).toEqual([clearance]);
    });

    it('finds a synced name used with bracket access', () => {
        expect(getSyncedAttributeReferences('user.attributes["Program"] == "x"', fields)).toEqual([program]);
    });

    it('works on a fixture with newlines', () => {
        expect(getSyncedAttributeReferences(fixture('d3 masking on GET').unwrapped, fields)).toEqual([clearance]);
    });
});
