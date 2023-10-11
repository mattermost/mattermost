// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import FileProgressPreview from './file_progress_preview';

describe('component/file_preview/file_progress_preview', () => {
    const handleRemove = jest.fn();
    const fiftyPercent = 50;
    const fileInfo = {
        name: 'test_filename',
        id: 'file',
        percent: fiftyPercent,
        type: 'image/png',
        extension: 'png',
        width: 100,
        height: 80,
        has_preview_image: true,
        user_id: '',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        size: 100,
        mime_type: '',
        clientId: '',
        archived: false,
    };

    const baseProps = {
        clientId: 'clientId',
        fileInfo,
        handleRemove,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <FileProgressPreview {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('snapshot for percent value undefined', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...fileInfo,
                percent: undefined,
            },
        };

        const wrapper = shallow(
            <FileProgressPreview {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
