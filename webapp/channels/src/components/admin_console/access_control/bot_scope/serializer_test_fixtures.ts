// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export const SERIALIZER_CASES: Array<{name: string; returned: string; unwrapped: string}> = [
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

export const fixture = (name: string) => {
    const found = SERIALIZER_CASES.find((c) => c.name === name);
    if (!found) {
        throw new Error(`missing fixture ${name}`);
    }
    return found;
};

export const PROGRAM_DRAGON = 'user.attributes.Program == "Dragon"';

export const BREAKOUT_TERNARY_E = 'user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret") : (user.attributes.Clearance == "Public"';
export const BREAKOUT_TERNARY_RETURNED = '(!user.isbot || user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret") : (user.attributes.Clearance == "Public")';

export const BREAKOUT_OR_E = 'user.attributes.Program == "Dragon") || (true';
export const BREAKOUT_OR_RETURNED = '!user.isbot || user.attributes.Program == "Dragon" || true';

export const COMMENT_E = 'user.attributes.Program == "Dragon" // note';
export const COMMENT_SUBMITTED = '!user.isbot || (user.attributes.Program == "Dragon" // note\n)';
export const COMMENT_RETURNED = '!user.isbot || user.attributes.Program == "Dragon"';

export const COMMENT_SUBMITTED_NO_NEWLINE = '!user.isbot || (user.attributes.Program == "Dragon" // note)';

export const MASKED_RETURNED = '!user.isbot || user.attributes.Level == "--------"';
export const MASKED_MIXED_RETURNED = '!user.isbot || user.attributes.Level == "--------" && user.attributes.Program == "Dragon"';
export const FIELD_DELETED_RETURNED = '!user.isbot || user.attributes.Temp == "--------"';
