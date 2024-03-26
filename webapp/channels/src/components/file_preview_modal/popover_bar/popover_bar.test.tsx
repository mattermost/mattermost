// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import PopoverBar from 'components/file_preview_modal/popover_bar/popover_bar';

describe('components/file_preview_modal/popover_bar/PopoverBar', () => {
    const defaultProps = {
        showZoomControls: false,
    };

    test('should match snapshot with zoom controls enabled', () => {
        const props = {
            ...defaultProps,
            showZoomControls: true,
        };

        const wrapper = shallow(<PopoverBar {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
