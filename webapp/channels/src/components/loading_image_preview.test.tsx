// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import LoadingImagePreview from 'components/loading_image_preview';

describe('components/LoadingImagePreview', () => {
    test('should match snapshot', () => {
        const loading = 'Loading';
        let progress = 50;

        const wrapper = shallow(
            <LoadingImagePreview
                loading={loading}
                progress={progress}
            />,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('span').text()).toBe('Loading 50%');

        progress = 90;
        wrapper.setProps({loading, progress});

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find('span').text()).toBe('Loading 90%');
    });
});
