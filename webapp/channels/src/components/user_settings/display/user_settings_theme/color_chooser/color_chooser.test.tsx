// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import ColorChooser from './color_chooser';

describe('components/user_settings/display/ColorChooser', () => {
    it('should match, init', () => {
        const wrapper = shallow(
            <ColorChooser
                label='Choose color'
                id='choose-color'
                value='#ffeec0'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
