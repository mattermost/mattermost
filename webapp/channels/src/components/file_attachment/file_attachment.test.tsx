// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

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
        isFileRejected: false,
        handleFileDropdownOpened: jest.fn(() => null),
        actions: {
            openModal: jest.fn(),
        },
    };

    test('should match snapshot, regular file', async () => {
        const {container} = await renderWithContext(<FileAttachment {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('non archived file does not show archived elements', async () => {
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
        await renderWithContext(<FileAttachment {...baseProps}/>, reduxState);

        expect(screen.queryByTestId('archived-file-icon')).not.toBeInTheDocument();
        expect(screen.queryByText(/This file is archived/)).not.toBeInTheDocument();
    });

    test('non archived file does not show archived elements in compact display mode', async () => {
        await renderWithContext(<FileAttachment {...{...baseProps, compactDisplay: true}}/>);

        expect(screen.queryByTestId('archived-file-icon')).not.toBeInTheDocument();
        expect(screen.queryByText(/archived/)).not.toBeInTheDocument();
    });

    test('should match snapshot, regular image', async () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 600,
            height: 400,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        const {container} = await renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, small image', async () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 16,
            height: 16,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        const {container} = await renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, svg image', async () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'svg',
            name: 'test.svg',
            width: 600,
            height: 400,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        const {container} = await renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, after change from file to image', async () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 600,
            height: 400,
            size: 100,
        };
        const {rerender, container} = await renderWithContext(<FileAttachment {...baseProps}/>);
        rerender(<FileAttachment {...{...baseProps, fileInfo}}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with compact display', async () => {
        const props = {...baseProps, compactDisplay: true};
        const {container} = await renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, without compact display and without can download', async () => {
        const props = {...baseProps, canDownloadFiles: false};
        const {container} = await renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, when file is not loaded', async () => {
        const {container} = await renderWithContext(<FileAttachment {...{...baseProps, fileInfo: {...baseProps.fileInfo, id: 'noLoad', extension: 'jpg'}, enableSVGs: true}}/>);
        expect(container).toMatchSnapshot();
    });

    test('should blur file attachment link after click', async () => {
        const props = {...baseProps, compactDisplay: true};
        await renderWithContext(<FileAttachment {...props}/>);

        const link = screen.getByText(baseProps.fileInfo.name);
        const blur = jest.spyOn(link, 'blur');
        await userEvent.click(link);
        expect(blur).toHaveBeenCalled();
    });

    describe('archived file', () => {
        test('shows archived image instead of real image and explanatory text in compact mode', async () => {
            const props = {
                ...baseProps,
                fileInfo: {
                    ...baseProps.fileInfo,
                    archived: true,
                },
                compactDisplay: true,
            };
            await renderWithContext(<FileAttachment {...props}/>);
            screen.getByTestId('archived-file-icon');
            screen.getByText(baseProps.fileInfo.name);
            screen.getByText(/archived/);
        });

        test('shows archived image instead of real image and explanatory text in full mode', async () => {
            const props = {
                ...baseProps,
                fileInfo: {
                    ...baseProps.fileInfo,
                    archived: true,
                },
                compactDisplay: false,
            };
            await renderWithContext(<FileAttachment {...props}/>);
            screen.getByTestId('archived-file-icon');
            screen.getByText(baseProps.fileInfo.name);
            screen.getByText(/This file is archived/);
        });
    });

    test('should match snapshot when file is deleted', async () => {
        const props = {
            ...baseProps,
            fileInfo: {
                ...baseFileInfo,
                delete_at: 10000000,
            },
        };
        const {container} = await renderWithContext(<FileAttachment {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with thumbnail disabled', async () => {
        const {container} = await renderWithContext(
            <FileAttachment
                {...baseProps}
                disableThumbnail={true}
            />);
        expect(container).toMatchSnapshot();
    });

    test('should not render menu items when disable actions is set', async () => {
        const {container} = await renderWithContext(
            <FileAttachment
                {...baseProps}
                disableActions={true}
            />);
        expect(container).toMatchSnapshot();
    });
});
