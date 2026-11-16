// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import ProductChannelsMenuItem from './switch_product_channels_menuitem';

describe('ProductChannelsMenuItem', () => {
    test('should always render the Channels entry', () => {
        renderWithContext(<ProductChannelsMenuItem isChannelsProductActive={false}/>);

        expect(screen.getByRole('menuitem')).toBeInTheDocument();
        expect(screen.getByText('Channels')).toBeInTheDocument();
    });

    test('should show a check icon when channels is the active product', () => {
        renderWithContext(<ProductChannelsMenuItem isChannelsProductActive={true}/>);

        // The channels icon plus the check icon.
        expect(screen.getByRole('menuitem').querySelectorAll('svg')).toHaveLength(2);
    });

    test('should not show a check icon when channels is not the active product', () => {
        renderWithContext(<ProductChannelsMenuItem isChannelsProductActive={false}/>);

        expect(screen.getByRole('menuitem').querySelectorAll('svg')).toHaveLength(1);
    });
});
