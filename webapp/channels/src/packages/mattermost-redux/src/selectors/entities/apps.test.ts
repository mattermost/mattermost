// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {GlobalState} from '@mattermost/types/store';

import * as Selectors from 'mattermost-redux/selectors/entities/apps';

const makeNewState = (disableAppBar?: string) => ({
    entities: {
        general: {
            config: {
                DisableAppBar: disableAppBar,
            },
        },
    },
}) as unknown as GlobalState;

describe('Selectors.Apps', () => {
    describe('appBarEnabled', () => {
        it('should return true when DisableAppBar is false', () => {
            const state = makeNewState('false');
            const result = Selectors.appBarEnabled(state);
            expect(result).toEqual(true);
        });

        it('should return false when DisableAppBar is true', () => {
            const state = makeNewState('true');
            const result = Selectors.appBarEnabled(state);
            expect(result).toEqual(false);
        });

        it('should return false when DisableAppBar is not set', () => {
            const state = makeNewState();
            const result = Selectors.appBarEnabled(state);
            expect(result).toEqual(false);
        });
    });
});
