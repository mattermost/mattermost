// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {uploadBrandImage, deleteBrandImage} from 'actions/admin_actions.jsx';
import {Client4} from 'mattermost-redux/client';

import BrandImageSetting from './brand_image_setting';

jest.mock('actions/admin_actions.jsx', () => ({
    ...jest.requireActual('actions/admin_actions.jsx'),
    uploadBrandImage: jest.fn(),
    deleteBrandImage: jest.fn(),
}));

Client4.setUrl('http://localhost:8065');

describe('components/admin_console/brand_image_setting', () => {
    const baseProps = {
        disabled: false,
        setSaveNeeded: jest.fn(),
        registerSaveAction: jest.fn(),
        unRegisterSaveAction: jest.fn(),
    };

    test('should have called deleteBrandImage or uploadBrandImage on save depending on component state', () => {
        const wrapper = shallow<BrandImageSetting>(
            <BrandImageSetting {...baseProps}/>,
        );

        const instance = wrapper.instance();

        wrapper.setState({deleteBrandImage: false, brandImage: new Blob(['brand_image_file'])});
        instance.handleSave();
        expect(deleteBrandImage).toHaveBeenCalledTimes(0);
        expect(uploadBrandImage).toHaveBeenCalledTimes(1);

        wrapper.setState({deleteBrandImage: true, brandImage: undefined});
        instance.handleSave();
        expect(deleteBrandImage).toHaveBeenCalledTimes(1);
        expect(uploadBrandImage).toHaveBeenCalledTimes(1);
    });
});
