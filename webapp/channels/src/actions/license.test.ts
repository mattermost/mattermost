// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';
import mockStore from 'tests/test_store';
import {tryGetPrevTrialLicense} from './license';

jest.mock('mattermost-redux/client', () => ({
    Client4: {
      getPrevTrialLicense: jest.fn(),
    }
}));

describe('actions/license', () => {
    describe('tryGetPrevTrialLicense', () => {
        it('should call getPrevTrialLicense when BuildEnterpriseReady is true', async () => {
            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            BuildEnterpriseReady: 'true',
                        },
                    },
              },
            });
            store.dispatch(tryGetPrevTrialLicense());
            expect(Client4.getPrevTrialLicense).toHaveBeenCalledTimes(1);
        });

        it('should not call getPrevTrialLicense when BuildEnterpriseReady is false', async () => {
            const store = mockStore({
                entities: {
                    general: {
                        config: {
                            BuildEnterpriseReady: 'false',
                        },
                    },
              },
            });
            store.dispatch(tryGetPrevTrialLicense());
            expect(Client4.getPrevTrialLicense).not.toHaveBeenCalled();
        });
    });
});