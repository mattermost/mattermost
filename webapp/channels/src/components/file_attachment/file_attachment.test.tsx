// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import FileAttachment from './file_attachment';

jest.mock('utils/utils', () => ({
    loadImage: jest.fn((id: string, callback: () => void) => {
        if (id !== 'noLoad') {
            callback();
        }
    }),
    localizeMessage: jest.fn((msg: {id: string; defaultMessage: string} | string, defaultMsg?: string) => {
        if (typeof msg === 'string') {
            return defaultMsg || msg;
        }
        return msg.defaultMessage || msg.id;
    }),
    imageURLForUser: jest.fn(() => ''),
    getFileType: jest.fn((extension: string) => {
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
        const videoExts = ['mp4', 'mov', 'avi', 'wmv'];
        const audioExts = ['mp3', 'wav', 'm4a', 'wma'];

        if (imageExts.includes(extension.toLowerCase())) {
            return 'image';
        }
        if (videoExts.includes(extension.toLowerCase())) {
            return 'video';
        }
        if (audioExts.includes(extension.toLowerCase())) {
            return 'audio';
        }
        return 'other';
    }),
    fileSizeToString: jest.fn((bytes: number) => {
        if (bytes < 1024) {
            return `${bytes} B`;
        }
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }),
    getIconClassName: jest.fn((fileType: string) => {
        const typeMap: Record<string, string> = {
            image: 'image',
            video: 'video',
            audio: 'audio',
            pdf: 'pdf',
            code: 'code',
            word: 'word',
            excel: 'excel',
            powerpoint: 'powerpoint',
            zip: 'zip',
        };
        return typeMap[fileType?.toLowerCase()] || 'generic';
    }),
    isGIFImage: jest.fn((extension: string) => {
        return extension?.toLowerCase() === 'gif';
    }),
}));

jest.mock('mattermost-redux/utils/file_utils', () => ({
    getFileThumbnailUrl: (fileId: string) => fileId,
    getFileUrl: (fileId: string) => fileId,
    getFileDownloadUrl: (fileId: string) => fileId,
    getFilePreviewUrl: (fileId: string) => fileId,
}));

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
        channel_id: 'channel_id',
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
        currentChannel: TestHelper.getChannelMock(),
        handleFileDropdownOpened: jest.fn(() => null),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot, regular file', () => {
        const {container} = renderWithContext(<FileAttachment {...baseProps}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {container} = renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
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
        const {rerender, container} = renderWithContext(<FileAttachment {...baseProps}/>);
        rerender(<FileAttachment {...{...baseProps, fileInfo}}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with compact display', () => {
        const props = {...baseProps, compactDisplay: true};
        const {container} = renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without compact display and without can download', () => {
        const props = {...baseProps, canDownloadFiles: false};
        const {container} = renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when file is not loaded', () => {
        const {container} = renderWithContext(<FileAttachment {...{...baseProps, fileInfo: {...baseProps.fileInfo, id: 'noLoad', extension: 'jpg'}, enableSVGs: true}}/>);
        expect(container).toMatchSnapshot();
    });

    test('should blur file attachment link after click', () => {
        const props = {...baseProps, compactDisplay: true};
        renderWithContext(<FileAttachment {...props}/>);

        const link = screen.getByText(baseProps.fileInfo.name);
        const blur = jest.spyOn(link, 'blur');
        fireEvent.click(link);
        expect(blur).toHaveBeenCalled();
    });

    describe('archived file', () => {
        test('shows archived image instead of real image and explanatory text in compact mode', () => {
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

        test('shows archived image instead of real image and explanatory text in full mode', () => {
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

    test('should match snapshot when file is deleted', () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...baseFileInfo,
                delete_at: 10000000,
            },
        };
        const {container} = renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with thumbnail disabled', () => {
        const {container} = renderWithContext(
            <FileAttachment
                {...baseProps}
                disableThumbnail={true}
            />);
        expect(container).toMatchSnapshot();
    });

    test('should not render menu items when disable actions is set', () => {
        const {container} = renderWithContext(
            <FileAttachment
                {...baseProps}
                disableActions={true}
            />);
        expect(container).toMatchSnapshot();
    });
});
