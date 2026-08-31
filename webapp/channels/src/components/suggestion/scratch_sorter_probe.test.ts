// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Temporary probe: not intended to be committed.

import type {WrappedChannel} from './switch_channel_provider';
import {quickSwitchSorter} from './switch_channel_provider';

function wrapped(id: string, type: string, lastViewedAt?: number): WrappedChannel {
    return {
        channel: {
            id,
            name: id,
            display_name: id,
            type,
            update_at: 0,
            delete_at: 0,
        },
        name: id,
        deactivated: false,
        last_viewed_at: lastViewedAt,
    };
}

describe('quickSwitchSorter transitivity probe', () => {
    const dm = wrapped('dm_old', 'D', 1);
    const gm = wrapped('gm_recent', 'G', 1000);
    const open = wrapped('open_middle', 'O', 500);

    it('pairwise preferences', () => {
        // eslint-disable-next-line no-console
        console.log('dm vs gm  ', quickSwitchSorter(dm, gm), quickSwitchSorter(gm, dm));

        // eslint-disable-next-line no-console
        console.log('gm vs open', quickSwitchSorter(gm, open), quickSwitchSorter(open, gm));

        // eslint-disable-next-line no-console
        console.log('dm vs open', quickSwitchSorter(dm, open), quickSwitchSorter(open, dm));
    });

    it('sort result depends on input order', () => {
        const permutations: Array<WrappedChannel[]> = [
            [dm, gm, open],
            [dm, open, gm],
            [gm, dm, open],
            [gm, open, dm],
            [open, dm, gm],
            [open, gm, dm],
        ];

        for (const permutation of permutations) {
            const input = permutation.map((w) => w.channel.id).join(', ');
            const output = [...permutation].sort(quickSwitchSorter).map((w) => w.channel.id).join(', ');

            // eslint-disable-next-line no-console
            console.log(`input [${input}] -> output [${output}]`);
        }
    });
});
