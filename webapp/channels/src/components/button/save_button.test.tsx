// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import SaveButton from './save_button';

describe('components/SaveButton', () => {
    const baseProps = {
        saving: false,
    };

    test('should match snapshot, on defaultMessage', () => {
        const wrapper = shallow(<SaveButton {...baseProps}/>);

        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({defaultMessage: 'Go'});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on savingMessage', () => {
        const props = {...baseProps, saving: true, disabled: true};
        const wrapper = shallow(<SaveButton {...props}/>);

        expect(wrapper).toMatchSnapshot();

        wrapper.setProps({savingMessage: 'Saving Config...'});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, extraClasses', () => {
        const props = {...baseProps, extraClasses: 'some-class'};
        const wrapper = shallow(<SaveButton {...props}/>);

        expect(wrapper).toMatchSnapshot();
    });
});
