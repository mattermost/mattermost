// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import ProductBrandingTeamEdition from './product_branding_team_edition';

describe('components/ProductBrandingTeamEdition', () => {
    test('should show correct product branding for team edition', () => {
        const wrapper = shallow(
            <ProductBrandingTeamEdition/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
