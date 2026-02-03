// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {getFileUrl} from 'mattermost-redux/utils/file_utils';

import FilePreview from './file_preview';

describe('FilePreview', () => {
    const onRemove = jest.fn();
    const fileInfos = [
        {
            width: 100,
            height: 100,
            name: 'test_filename',
            id: 'file_id_1',
            type: 'image/png',
            extension: 'png',
            has_preview_image: true,
            user_id: '',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    ];
    const uploadsInProgress = ['clientID_1'];
    const uploadsProgressPercent = {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        clientID_1: {
            width: 100,
            height: 100,
            name: 'file',
            percent: 50,
            extension: 'image/png',
            id: 'file_id_1',
            has_preview_image: true,
            user_id: '',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 100,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    };

    const baseProps = {
        enableSVGs: false,
        fileInfos,
        uploadsInProgress,
        onRemove,
        uploadsProgressPercent,
    };

    test('should match snapshot', () => {
        const wrapper = shallow(
            <FilePreview {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot when props are changed', () => {
        const wrapper = shallow(
            <FilePreview {...baseProps}/>,
        );
        expect(wrapper).toMatchSnapshot();
        const fileInfo2 = {
            id: 'file_id_2',
            create_at: '2',
            width: 100,
            height: 100,
            extension: 'jpg',
        };
        const newFileInfos = [...fileInfos, fileInfo2];
        wrapper.setProps({
            fileInfos: newFileInfos,
            uploadsInProgress: [],
        });
        expect(wrapper).toMatchSnapshot();
    });

    test('should call handleRemove when file removed', () => {
        const newOnRemove = jest.fn();
        const props = {...baseProps, onRemove: newOnRemove};
        const wrapper = shallow<FilePreview>(
            <FilePreview {...props}/>,
        );

        wrapper.instance().handleRemove('');
        expect(newOnRemove).toHaveBeenCalled();
    });

    test('should not render an SVG when SVGs are disabled', () => {
        const fileId = 'file_id_1';
        const props = {
            ...baseProps,
            fileInfos: [
                {
                    ...baseProps.fileInfos[0],
                    type: 'image/svg',
                    extension: 'svg',
                },
            ],
        };

        const wrapper = shallow(
            <FilePreview {...props}/>,
        );

        expect(wrapper.find('img').find({src: getFileUrl(fileId)}).exists()).toBe(false);
        expect(wrapper.find('div').find('.file-icon.generic').exists()).toBe(true);
    });

    test('should render an SVG when SVGs are enabled', () => {
        const fileId = 'file_id_1';
        const props = {
            ...baseProps,
            enableSVGs: true,
            fileInfos: [
                {
                    ...baseProps.fileInfos[0],
                    type: 'image/svg',
                    extension: 'svg',
                },
            ],
        };

        const wrapper = shallow(
            <FilePreview {...props}/>,
        );

        expect(wrapper.find('img').find({src: getFileUrl(fileId)}).exists()).toBe(true);
        expect(wrapper.find('div').find('.file-icon.generic').exists()).toBe(false);
    });
});
