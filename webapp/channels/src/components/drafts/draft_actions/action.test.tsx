// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import Action from './action';

describe('components/drafts/draft_actions/action', () => {
    const baseProps = {
        icon: 'some-icon',
        id: 'some-id',
        name: 'some-name',
        onClick: jest.fn(),
        tooltipText: 'some-tooltip-text',
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <Action
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
