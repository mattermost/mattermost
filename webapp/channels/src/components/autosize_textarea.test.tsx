// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

import {AutosizeTextarea} from 'components/autosize_textarea';

describe('components/AutosizeTextarea', () => {
    test('should match snapshot, init', () => {
        const wrapper = shallow(
            <AutosizeTextarea/>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
