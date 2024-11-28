// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import userEvent from '@testing-library/user-event';

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

    test('renders regular file correctly', () => {
        renderWithContext(<FileAttachment {...baseProps}/>, reduxState);

        expect(screen.getByText(baseProps.fileInfo.name)).toBeInTheDocument();
        expect(screen.getByText('PDF')).toBeInTheDocument();
        expect(screen.getByText('100B')).toBeInTheDocument();
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

    test('renders regular image correctly', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 600,
            height: 400,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        renderWithContext(<FileAttachment {...props}/>, reduxState);

        expect(screen.getByText('test.png')).toBeInTheDocument();
        expect(screen.getByText('PNG')).toBeInTheDocument();
        expect(screen.getByText('100B')).toBeInTheDocument();
        expect(screen.getByLabelText(/file thumbnail test.png/i)).toBeInTheDocument();
    });

    test('renders small image correctly', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'png',
            name: 'test.png',
            width: 16,
            height: 16,
            size: 100,
        };
        const props = {...baseProps, fileInfo};
        renderWithContext(<FileAttachment {...props}/>, reduxState);

        expect(screen.getByText('test.png')).toBeInTheDocument();
        expect(screen.getByText('PNG')).toBeInTheDocument();
        expect(screen.getByLabelText(/file thumbnail test.png/i)).toBeInTheDocument();
    });

    test('renders svg image correctly when SVGs are enabled', () => {
        const fileInfo = {
            ...baseFileInfo,
            extension: 'svg',
            name: 'test.svg',
            width: 600,
            height: 400,
            size: 100,
        };
        const props = {...baseProps, fileInfo, enableSVGs: true};
        renderWithContext(<FileAttachment {...props}/>, reduxState);

        expect(screen.getByText('test.svg')).toBeInTheDocument();
        expect(screen.getByText('SVG')).toBeInTheDocument();
        expect(screen.getByLabelText(/file thumbnail test.svg/i)).toBeInTheDocument();
    });

    test('renders with compact display correctly', () => {
        const props = {...baseProps, compactDisplay: true};
        renderWithContext(<FileAttachment {...props}/>, reduxState);

        expect(screen.getByText(baseProps.fileInfo.name)).toBeInTheDocument();
        expect(screen.queryByText('PDF')).not.toBeInTheDocument(); // Compact mode doesn't show extension
    });

    test('renders without download option when canDownloadFiles is false', () => {
        const props = {...baseProps, canDownloadFiles: false};
        renderWithContext(<FileAttachment {...props}/>, reduxState);

        expect(screen.queryByRole('button', {name: /download/i})).not.toBeInTheDocument();
    });

    test('shows loading state when image is not loaded', () => {
        renderWithContext(
            <FileAttachment
                {...baseProps}
                fileInfo={{...baseProps.fileInfo, id: 'noLoad', extension: 'jpg'}}
                enableSVGs={true}
            />,
            reduxState
        );

        expect(screen.getByTestId('fileAttachmentArchivedTooltip')).toBeInTheDocument();
        expect(screen.getByText(baseProps.fileInfo.name)).toBeInTheDocument();
    });

    test('should blur file attachment link after click', async () => {
        const props = {...baseProps, compactDisplay: true};
        renderWithContext(<FileAttachment {...props}/>, reduxState);

        const link = screen.getByText(baseProps.fileInfo.name);
        const blur = jest.spyOn(link, 'blur');
        
        await userEvent.click(link);
        expect(blur).toHaveBeenCalled();
        expect(props.handleImageClick).toHaveBeenCalledWith(props.index);
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
