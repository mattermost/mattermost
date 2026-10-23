// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

const CASES: Array<{name: string; expression: string}> = [
    {
        name: 'a masking on GET',
        expression: 'user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" &&\nuser.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" &&\nuser.attributes.Clearance != "Restricted"',
    },
    {
        name: 'a masking on search',
        expression: 'user.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h == "Secret" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr == "Dragon" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Public" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_ht5zt6domfbexcfor5hiymn9dr != "Phoenix" &&\nuser.id_7swqffpxy7dnxyf6wipuc8grwr.id_9f34qgf7zb817xobspzmk1qx1h != "Restricted"',
    },
    {
        name: 'b masking on GET',
        expression: 'user.attributes.Clearance == "Secret" || user.attributes.Program == "Dragon" ||\nuser.attributes.Clearance == "TopSecret" || user.attributes.Program == "Phoenix" ||\nuser.attributes.Clearance == "Restricted"',
    },
    {
        name: 'c masking on GET',
        expression: '(user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" &&\nuser.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" &&\nuser.attributes.Program == "Hydra")',
    },
    {
        name: 'd1 masking on GET',
        expression: '"a" in user.attributes.Tags || "b" in user.attributes.Tags',
    },
    {
        name: 'd2 masking on GET',
        expression: '("a" in user.attributes.Tags || "b" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
    },
    {
        name: 'd3 masking on GET',
        expression: '("a" in user.attributes.Tags || "b" in user.attributes.Tags || "c" in user.attributes.Tags ||\n"d" in user.attributes.Tags) && user.attributes.Clearance == "Secret"',
    },
    {
        name: 'e masking on GET',
        expression: 'user.attributes.Program in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
    },
    {
        name: 'a masking off GET',
        expression: 'user.attributes.Clearance == "Secret" && user.attributes.Program == "Dragon" && user.attributes.Clearance != "Public" && user.attributes.Program != "Phoenix" && user.attributes.Clearance != "Restricted"',
    },
    {
        name: 'b masking off GET',
        expression: 'user.attributes.Clearance == "Secret" || user.attributes.Program == "Dragon" || user.attributes.Clearance == "TopSecret" || user.attributes.Program == "Phoenix" || user.attributes.Clearance == "Restricted"',
    },
    {
        name: 'c masking off GET',
        expression: '(user.attributes.Program == "Dragon") ? (user.attributes.Clearance == "Secret" && user.attributes.Program != "Phoenix") : (user.attributes.Clearance == "TopSecret" && user.attributes.Program == "Hydra")',
    },
    {
        name: 'd1 masking off GET',
        expression: '"a" in user.attributes.Tags || "b" in user.attributes.Tags',
    },
    {
        name: 'e masking off GET',
        expression: 'user.attributes.Program in ["Dragon", "Phoenix", "Hydra", "Kraken", "Basilisk", "Chimera", "Griffin", "Manticore", "Wyvern"]',
    },
];

export const fixture = (name: string) => {
    const found = CASES.find((c) => c.name === name);
    if (!found) {
        throw new Error(`missing fixture ${name}`);
    }
    return found;
};
