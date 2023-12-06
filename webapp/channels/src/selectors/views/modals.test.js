// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {isModalOpen} from 'selectors/views/modals';

describe('modals selector', () => {
    const state = {
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
        expect(isModalOpen(state, 'someModalId')).toBeTruthy();
    });

    it('should return false when the given ModalId is not in state', () => {
        expect(isModalOpen(state, 'unknownModalId')).toBeFalsy();
    });
});
