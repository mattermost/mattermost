// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import BetaTag from './beta_tag';

describe('components/widgets/tag/BetaTag', () => {
    test('should match the snapshot', () => {
        const wrapper = shallow(<BetaTag className={'test'}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
