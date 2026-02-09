// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import FilePreview from 'components/file_preview/file_preview';

// Mock isEncryptedFile
jest.mock('utils/encryption/file', () => ({
    isEncryptedFile: () => false,
}));

describe('FilePreview spoiler functionality', () => {
    const fileInfos = [
        {
            width: 100,
            height: 100,
            name: 'test_image.png',
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
        {
            width: 200,
            height: 200,
            name: 'test_image_2.png',
            id: 'file_id_2',
            type: 'image/png',
            extension: 'png',
            has_preview_image: true,
            user_id: '',
            channel_id: 'channel_id',
            create_at: 0,
            update_at: 0,
            delete_at: 0,
            size: 200,
            mime_type: '',
            clientId: '',
            archived: false,
        },
    ];

    const baseProps = {
        enableSVGs: false,
        fileInfos,
        uploadsInProgress: [],
        onRemove: jest.fn(),
        uploadsProgressPercent: {},
    };

    test('should show spoiler toggle button when onToggleSpoiler is provided', () => {
        const wrapper = shallow(
            <FilePreview
                {...baseProps}
                onToggleSpoiler={jest.fn()}
                spoilerFileIds={[]}
            />,
        );

        expect(wrapper.find('.icon-eye-outline').exists()).toBe(true);
    });

    test('should not show spoiler toggle button when onToggleSpoiler is not provided', () => {
        const wrapper = shallow(<FilePreview {...baseProps}/>);

        expect(wrapper.find('.icon-eye-outline').exists()).toBe(false);
        expect(wrapper.find('.icon-eye-off-outline').exists()).toBe(false);
    });

    test('should show eye-off icon when file is marked as spoiler', () => {
        const wrapper = shallow(
            <FilePreview
                {...baseProps}
                onToggleSpoiler={jest.fn()}
                spoilerFileIds={['file_id_1']}
            />,
        );

        // First file should show eye-off (spoilered)
        const firstFile = wrapper.find('.file-preview').at(0);
        expect(firstFile.find('.icon-eye-off-outline').exists()).toBe(true);

        // Second file should show eye (not spoilered)
        const secondFile = wrapper.find('.file-preview').at(1);
        expect(secondFile.find('.icon-eye-outline').exists()).toBe(true);
    });

    test('should call onToggleSpoiler with file id when eye icon is clicked', () => {
        const onToggleSpoiler = jest.fn();
        const wrapper = shallow(
            <FilePreview
                {...baseProps}
                onToggleSpoiler={onToggleSpoiler}
                spoilerFileIds={[]}
            />,
        );

        // Click the spoiler toggle on the first file
        wrapper.find('.icon-eye-outline').at(0).closest('a').simulate('click');
        expect(onToggleSpoiler).toHaveBeenCalledWith('file_id_1');
    });

    test('should add file-preview--spoilered class when file is marked as spoiler', () => {
        const wrapper = shallow(
            <FilePreview
                {...baseProps}
                onToggleSpoiler={jest.fn()}
                spoilerFileIds={['file_id_1']}
            />,
        );

        const firstFile = wrapper.find('.file-preview').at(0);
        expect(firstFile.hasClass('file-preview--spoilered')).toBe(true);

        const secondFile = wrapper.find('.file-preview').at(1);
        expect(secondFile.hasClass('file-preview--spoilered')).toBe(false);
    });

    test('should not add file-preview--spoilered class when no files are spoilered', () => {
        const wrapper = shallow(
            <FilePreview
                {...baseProps}
                onToggleSpoiler={jest.fn()}
                spoilerFileIds={[]}
            />,
        );

        expect(wrapper.find('.file-preview--spoilered').exists()).toBe(false);
    });

    test('should show correct title on spoiler toggle', () => {
        const wrapper = shallow(
            <FilePreview
                {...baseProps}
                onToggleSpoiler={jest.fn()}
                spoilerFileIds={['file_id_1']}
            />,
        );

        // Spoilered file should show "Remove spoiler"
        expect(wrapper.find('[title="Remove spoiler"]').exists()).toBe(true);

        // Non-spoilered file should show "Mark as spoiler"
        expect(wrapper.find('[title="Mark as spoiler"]').exists()).toBe(true);
    });
});
