// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {LicenseSkus} from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

import type {GlobalState} from 'types/store';

import ProductSwitcherEditionFooter from './switch_product_edition_menuitem';

describe('ProductSwitcherEditionFooter', () => {
    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    SkuShortName: 'Enterprise',
                },
            },
            users: {
                currentUserId: 'user_id',
                profiles: {
                    user_id: TestHelper.getUserMock({id: 'user_id'}),
                },
            },
        },
    };

    test('should not show when licensed and not entry SKU (e.g., Professional)', () => {
        const state = {
            entities: {
                ...initialState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: LicenseSkus.Professional,
                    },
                },
            },
        };

        renderWithContext(<ProductSwitcherEditionFooter/>, state);

        expect(screen.queryByText('TEAM EDITION')).not.toBeInTheDocument();
        expect(screen.queryByText('ENTRY EDITION')).not.toBeInTheDocument();
    });

    test("should show when it's unlicensed", () => {
        const state = {
            entities: {
                ...initialState.entities,
                general: {license: {IsLicensed: 'false'}},
            },
        };

        renderWithContext(<ProductSwitcherEditionFooter/>, state);

        expect(screen.getByText('TEAM EDITION')).toBeInTheDocument();
        expect(screen.getByText(/unsupported/)).toBeInTheDocument();
    });

    test("should show when it's licensed with entry SKU", () => {
        const state = {
            entities: {
                ...initialState.entities,
                general: {
                    license: {
                        IsLicensed: 'true',
                        SkuShortName: LicenseSkus.Entry,
                    },
                },
            },
        };

        renderWithContext(<ProductSwitcherEditionFooter/>, state);

        expect(screen.getByText('ENTRY EDITION')).toBeInTheDocument();
    });
});
