// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import SharedUserIndicator from './shared_user_indicator';

describe('components/SharedUserIndicator', () => {
    test('should match snapshot without tooltip', () => {
        const wrapper = shallow(<SharedUserIndicator className='test-class-name'/>);

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with tooltip', () => {
        const wrapper = shallow(
            <SharedUserIndicator
                className='test-class-name'
                withTooltip={true}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
    
    test('should match snapshot with custom title', () => {
        const wrapper = shallow(
            <SharedUserIndicator
                className='test-class-name'
                withTooltip={true}
                title='Custom title'
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
    
    test('should match snapshot with remote names', () => {
        const remoteNames = ['Remote Workspace 1', 'Remote Workspace 2'];
        
        const wrapper = shallow(
            <SharedUserIndicator
                className='test-class-name'
                withTooltip={true}
                remoteNames={remoteNames}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});