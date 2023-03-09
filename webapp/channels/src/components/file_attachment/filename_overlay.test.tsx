// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import FilenameOverlay from 'components/file_attachment/filename_overlay';
import AttachmentIcon from 'components/widgets/icons/attachment_icon';

describe('components/file_attachment/FilenameOverlay', () => {
    function emptyFunction() {} //eslint-disable-line no-empty-function
    const fileInfo = {
        id: 'thumbnail_id',
        name: 'test_filename',
        extension: 'jpg',
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
        fileInfo,
        handleImageClick: emptyFunction,
        compactDisplay: false,
        canDownload: true,
    };

    test('should match snapshot, standard display', () => {
        const wrapper = shallow(
            <FilenameOverlay {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, compact display', () => {
        const handleImageClick = jest.fn();
        const props = {...baseProps, compactDisplay: true, handleImageClick};
        const wrapper = shallow(
            <FilenameOverlay {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(AttachmentIcon).exists()).toBe(true);

        wrapper.find('a').first().simulate('click');
        expect(handleImageClick).toHaveBeenCalledTimes(1);
    });

    test('should match snapshot, with Download icon as children', () => {
        const props = {...baseProps, canDownload: true};
        const wrapper = shallow(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        expect(wrapper).toMatchSnapshot();
        expect(wrapper.find(AttachmentIcon).exists()).toBe(true);
    });

    test('should match snapshot, standard but not downloadable', () => {
        const props = {...baseProps, canDownload: false};
        const wrapper = shallow(
            <FilenameOverlay {...props}>
                <AttachmentIcon/>
            </FilenameOverlay>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
