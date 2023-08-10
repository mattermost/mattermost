// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import * as useCWSAvailabilityCheckAll from 'components/common/hooks/useCWSAvailabilityCheck';

import {renderWithIntlAndStore, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';
import {TestHelper as TH} from 'utils/test_helper';

import TrueUpReview from './true_up_review';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

describe('TrueUpReview', () => {
    const showsTrueUpReviewStore: DeepPartial<GlobalState> = {
        entities: {
            general: {
                license: TH.getLicenseMock({
                    IsGovSku: 'false',
                    Cloud: 'false',
                    SkuShortName: LicenseSkus.Enterprise,
                    IsLicensed: 'true',
                }),
                config: {
                    EnableDiagnostics: 'false',
                },
            },
            users: {
                currentUserId: 'userId',
                profiles: {
                    userId: TH.getUserMock({
                        id: 'userId',
                        roles: 'system_admin',
                    }),
                },
            },
            hostedCustomer: {
                trueUpReviewStatus: {

                    // one day in future so we're sure it will display,
                    // regardless of future changes to "do we show it if it already passed"
                    due_date: Date.now() + (1000 * 60 * 60 * 24),
                    complete: false,
                    getRequestState: 'IDLE',
                },
                trueUpReviewProfile: {
                    getRequestState: 'IDLE',
                    content: '',
                },
                errors: {},
            },
        },

    };
    it('regular self hosted license in the true up window sees content', () => {
        jest.spyOn(useCWSAvailabilityCheckAll, 'default').mockImplementation(() => true);

        renderWithIntlAndStore(<TrueUpReview/>, showsTrueUpReviewStore);
        screen.getByText('Share to Mattermost');
    });

    it('gov sku self-hosted license does not see true up content', () => {
        const store = JSON.parse(JSON.stringify(showsTrueUpReviewStore));
        store.entities.general.license.IsGovSku = 'true';
        jest.spyOn(useCWSAvailabilityCheckAll, 'default').mockImplementation(() => true);

        renderWithIntlAndStore(<TrueUpReview/>, store);
        expect(screen.queryByText('Share to Mattermost')).not.toBeInTheDocument();
    });
});
