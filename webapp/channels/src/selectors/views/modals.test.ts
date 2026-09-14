// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {DeepPartial} from '@mattermost/types/utilities';

import {isModalOpen} from 'selectors/views/modals';

import type {GlobalState} from 'types/store';

describe('modals selector', () => {
    const state: DeepPartial<GlobalState> = {
        views: {
            modals: {
                modalState: {
                    someModalId: {
                        open: true,
                    },
                },
            },
        },
    };

    it('should return the isOpen value from the state for the given modalId', () => {
        expect(isModalOpen(state as GlobalState, 'someModalId')).toBeTruthy();
    });

    it('should return false when the given ModalId is not in state', () => {
        expect(isModalOpen(state as GlobalState, 'unknownModalId')).toBeFalsy();
    });
});
