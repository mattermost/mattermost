// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Panel from './panel';

describe('components/drafts/panel/', () => {
    const baseProps = {
        children: jest.fn(),
        onClick: jest.fn(),
        hasError: false,
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <Panel
                {...baseProps}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
