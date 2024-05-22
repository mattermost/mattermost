// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import FileAttachment from './file_attachment';

jest.mock('utils/utils', () => {
    const original = jest.requireActual('utils/utils');
    return {
        ...original,
        loadImage: jest.fn((id: string, callback: () => void) => {
            if (id !== 'noLoad') {
                callback();
            }
        }),
    };
});

jest.mock('mattermost-redux/utils/file_utils', () => {
    const original = jest.requireActual('mattermost-redux/utils/file_utils');
    return {
        ...original,
        getFileThumbnailUrl: (fileId: string) => fileId,
    };
});

describe('FileAttachment', () => {
    const baseFileInfo = {
        id: 'thumbnail_id',
        extension: 'pdf',
        name: 'test.pdf',
        size: 100,
        width: 100,
        height: 80,
        has_preview_image: true,
        user_id: '',
        create_at: 0,
        update_at: 0,
        delete_at: 0,
        mime_type: '',
        clientId: '',
        archived: false,
    };

    const baseProps = {
        fileInfo: baseFileInfo,
        handleImageClick: jest.fn(),
        index: 3,
        canDownloadFiles: true,
        enableSVGs: false,
        enablePublicLink: false,
        pluginMenuItems: [],
        handleFileDropdownOpened: jest.fn(() => null),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot, regular file', () => {
        const wrapper = shallow(<FileAttachment {...baseProps}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('non archived file does not show archived elements', () => {
        const reduxState: DeepPartial<GlobalState> = {
            entities: {
                general: {
                    config: {},
                },
                users: {
                    currentUserId: 'currentUserId',
                },
            },
        };
        renderWithContext(<FileAttachment {...baseProps}/>, reduxState);

        expect(screen.queryByTestId('archived-file-icon')).not.toBeInTheDocument();
        expect(screen.queryByText(/This file is archived/)).not.toBeInTheDocument();
    });

    test('non archived file does not show archived elements in compact display mode', () => {
        renderWithContext(<FileAttachment {...{...baseProps, compactDisplay: true}}/>);

        expect(screen.queryByTestId('archived-file-icon')).not.toBeInTheDocument();
        expect(screen.queryByText(/archived/)).not.toBeInTheDocument();
    });

    test('should match snapshot, regular image', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 600,
            height: 400,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        const wrapper = shallow(<FileAttachment {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, small image', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 16,
            height: 16,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        const wrapper = shallow(<FileAttachment {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, svg image', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'svg',
            name: 'test.svg',
            width: 600,
            height: 400,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        const wrapper = shallow(<FileAttachment {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, after change from file to image', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 600,
            height: 400,
            size: 100,
        };
        const wrapper = shallow(<FileAttachment {...baseProps}/>);
        wrapper.setProps({...baseProps, fileInfo});
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, with compact display', () => {
        const props = {...baseProps, compactDisplay: true};
        const wrapper = shallow(<FileAttachment {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, without compact display and without can download', () => {
        const props = {...baseProps, canDownloadFiles: false};
        const wrapper = shallow(<FileAttachment {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, when file is not loaded', () => {
        const wrapper = shallow(<FileAttachment {...{...baseProps, fileInfo: {...baseProps.fileInfo, id: 'noLoad', extension: 'jpg'}, enableSVGs: true}}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should blur file attachment link after click', () => {
        const props = {...baseProps, compactDisplay: true};
        renderWithContext(<FileAttachment {...props}/>);

        const link = screen.getByText(baseProps.fileInfo.name);
        const blur = jest.spyOn(link, 'blur');
        screen.getByText(baseProps.fileInfo.name).click();
        expect(blur).toHaveBeenCalled();
    });

    describe('archived file', () => {
        test('shows archived image instead of real image and explanatory test in compact mode', () => {
            const props = {
                ...baseProps,
                fileInfo: {
                    ...baseProps.fileInfo,
                    archived: true,
                },
                compactDisplay: true,
            };
            renderWithContext(<FileAttachment {...props}/>);
            screen.getByTestId('archived-file-icon');
            screen.getByText(baseProps.fileInfo.name);
            screen.getByText(/archived/);
        });

        test('shows archived image instead of real image and explanatory test in full mode', () => {
            const props = {
                ...baseProps,
                fileInfo: {
                    ...baseProps.fileInfo,
                    archived: true,
                },
                compactDisplay: false,
            };
            renderWithContext(<FileAttachment {...props}/>);
            screen.getByTestId('archived-file-icon');
            screen.getByText(baseProps.fileInfo.name);
            screen.getByText(/This file is archived/);
        });
    });
});
