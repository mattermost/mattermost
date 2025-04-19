// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import SharedChannelIndicator from './shared_channel_indicator';

describe('components/SharedChannelIndicator', () => {
    test('should match snapshot without tooltip', () => {
        const wrapper = shallow(<SharedChannelIndicator className='test-class-name'/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with tooltip', () => {
        const wrapper = shallow(
            <SharedChannelIndicator
                className='test-class-name'
                withTooltip={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with remote names', () => {
        const remoteNames = ['Remote Workspace 1', 'Remote Workspace 2'];
        
        const wrapper = shallow(
            <SharedChannelIndicator
                className='test-class-name'
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});