// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import Panel from './panel';

describe('components/drafts/panel/', () => {
    const baseProps = {
        children: jest.fn(),
        onClick: jest.fn(),
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
