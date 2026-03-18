// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FilePreviewModal from 'components/file_preview_modal/file_preview_modal';

import {act, render} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';
import * as Utils from 'utils/utils';
import {generateId} from 'utils/utils';

jest.mock('react-bootstrap', () => {
    const Modal = ({children, show}: {children: React.ReactNode; show: boolean}) => (show ? <div>{children}</div> : null);
    Modal.Header = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    Modal.Body = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    Modal.Title = ({children}: {children: React.ReactNode}) => <div>{children}</div>;
    return {Modal};
});

jest.mock('components/archived_preview', () => () => <div>{'Archived Preview'}</div>);
jest.mock('components/audio_video_preview', () => () => <div>{'Audio Video Preview'}</div>);
jest.mock('components/code_preview', () => ({
    __esModule: true,
    default: () => <div>{'Code Preview'}</div>,
    hasSupportedLanguage: () => true,
}));
jest.mock('components/file_info_preview', () => () => <div>{'File Info Preview'}</div>);
jest.mock('components/loading_image_preview', () => () => <div>{'Loading Image Preview'}</div>);
jest.mock('components/pdf_preview', () => ({
    __esModule: true,
    default: () => <div>{'PDF Preview'}</div>,
}));
jest.mock('components/file_preview_modal/file_preview_modal_footer/file_preview_modal_footer', () => () => (
    <div>{'File Preview Modal Footer'}</div>
));
jest.mock('components/file_preview_modal/file_preview_modal_header/file_preview_modal_header', () => () => (
    <div>{'File Preview Modal Header'}</div>
));
jest.mock('components/file_preview_modal/image_preview', () => () => <div>{'Image Preview'}</div>);
jest.mock('components/file_preview_modal/popover_bar', () => () => <div>{'Popover Bar'}</div>);

describe('components/FilePreviewModal', () => {
    const baseProps = {
        fileInfos: [TestHelper.getFileInfoMock({id: 'file_id', extension: 'jpg'})],
        startIndex: 0,
        canDownloadFiles: true,
        enablePublicLink: true,
        isMobileView: false,
        post: TestHelper.getPostMock(),
        onExited: jest.fn(),
    };

    const renderModal = (props = baseProps) => {
        const ref = React.createRef<FilePreviewModal>();
        const utils = render(
            <FilePreviewModal
                ref={ref}
                {...props}
            />,
        );
        return {ref, ...utils};
    };

    test('should match snapshot', () => {
        const {container} = renderModal();
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with image', () => {
        const {container, ref} = renderModal();
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with .mov file', () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'mov'})];
        const props = {...baseProps, fileInfos};
        const {container, ref} = renderModal(props);
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with .m4a file', () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'm4a'})];
        const props = {...baseProps, fileInfos};
        const {container, ref} = renderModal(props);
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with .js file', () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'js'})];
        const props = {...baseProps, fileInfos};
        const {container, ref} = renderModal(props);
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with other file', () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'other'})];
        const props = {...baseProps, fileInfos};
        const {container, ref} = renderModal(props);
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded with footer', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};
        const {container, ref} = renderModal(props);
        act(() => {
            ref.current?.setState({loaded: [true, true, true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded', () => {
        const {container, ref} = renderModal();
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, loaded and showing footer', () => {
        const {container, ref} = renderModal();
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });
        expect(container).toMatchSnapshot();
    });

    test('should go to next or previous upon key press of right or left, respectively', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};
        const {ref} = renderModal(props);
        act(() => {
            ref.current?.setState({loaded: [true, true, true] as any});
        });

        let evt = {key: Constants.KeyCodes.RIGHT[0]} as KeyboardEvent;
        act(() => {
            ref.current?.handleKeyPress(evt);
        });
        expect(ref.current?.state.imageIndex).toBe(1);
        act(() => {
            ref.current?.handleKeyPress(evt);
        });
        expect(ref.current?.state.imageIndex).toBe(2);

        evt = {key: Constants.KeyCodes.LEFT[0]} as KeyboardEvent;
        act(() => {
            ref.current?.handleKeyPress(evt);
        });
        expect(ref.current?.state.imageIndex).toBe(1);
        act(() => {
            ref.current?.handleKeyPress(evt);
        });
        expect(ref.current?.state.imageIndex).toBe(0);
    });

    test('should handle onMouseEnter and onMouseLeave', () => {
        const {ref} = renderModal();
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });

        act(() => {
            ref.current?.onMouseEnterImage();
        });
        expect(ref.current?.state.showCloseBtn).toBe(true);

        act(() => {
            ref.current?.onMouseLeaveImage();
        });
        expect(ref.current?.state.showCloseBtn).toBe(false);
    });

    test('should handle on modal close', () => {
        const {ref} = renderModal();
        act(() => {
            ref.current?.setState({loaded: [true] as any});
        });

        act(() => {
            ref.current?.handleModalClose();
        });
        expect(ref.current?.state.show).toBe(false);
    });

    test('should match snapshot for external file', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({extension: 'png'}),
        ];
        const props = {...baseProps, fileInfos};
        const {container} = renderModal(props);
        expect(container).toMatchSnapshot();
    });

    test('should correctly identify image URLs with isImageUrl method', () => {
        const {ref} = renderModal();

        // Test proxied image URLs
        expect(ref.current?.isImageUrl('http://localhost:8065/api/v4/image?url=https%3A%2F%2Fexample.com%2Fimage.jpg')).toBe(true);

        // Test URLs with image extensions
        expect(ref.current?.isImageUrl('https://example.com/image.jpg')).toBe(true);
        expect(ref.current?.isImageUrl('https://example.com/image.png')).toBe(true);
        expect(ref.current?.isImageUrl('https://example.com/image.gif')).toBe(true);

        // Test non-image URLs
        expect(ref.current?.isImageUrl('https://example.com/document.pdf')).toBe(false);
        expect(ref.current?.isImageUrl('https://example.com/file.txt')).toBe(false);
    });

    test('should handle external image URLs correctly', () => {
        // Create a mock for Utils.loadImage
        const loadImageSpy = jest.spyOn(Utils, 'loadImage').mockImplementation((url, onLoad) => {
            // Create a mock ProgressEvent
            const mockProgressEvent = new ProgressEvent('progress');

            // Call onLoad with the mock event if it exists
            if (onLoad) {
                onLoad.call({} as XMLHttpRequest, mockProgressEvent);
            }
        });

        // Create a LinkInfo object for an external image URL
        const externalImageUrl = 'http://localhost:8065/api/v4/image?url=https%3A%2F%2Fexample.com%2Fimage.jpg';
        const fileInfos = [
            TestHelper.getFileInfoMock({
                id: '',
                has_preview_image: false,
                link: externalImageUrl,
                extension: '',
                name: 'External Image',
            }),
        ];

        const props = {...baseProps, fileInfos};
        const {ref} = renderModal(props);

        const handleImageLoadedSpy = jest.spyOn(ref.current as FilePreviewModal, 'handleImageLoaded');

        act(() => {
            ref.current?.loadImage(0);
        });

        // Verify that Utils.loadImage was called with the correct URL
        expect(loadImageSpy).toHaveBeenCalledWith(
            externalImageUrl,
            expect.any(Function),
            expect.any(Function),
        );

        // Verify that handleImageLoaded was called
        expect(handleImageLoadedSpy).toHaveBeenCalled();

        // Restore the original loadImage function
        loadImageSpy.mockRestore();
    });

    test('should have called loadImage', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};
        const {ref} = renderModal(props);

        let index = 1;
        act(() => {
            ref.current?.setState({loaded: [true, false, false] as any});
            ref.current?.loadImage(index);
        });

        expect(ref.current?.state.loaded[index]).toBe(true);

        index = 2;
        act(() => {
            ref.current?.loadImage(index);
        });
        expect(ref.current?.state.loaded[index]).toBe(true);
    });

    test('should handle handleImageLoaded', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};
        const {ref} = renderModal(props);

        let index = 1;
        act(() => {
            ref.current?.setState({loaded: [true, false, false] as any});
            ref.current?.handleImageLoaded(index);
        });

        expect(ref.current?.state.loaded[index]).toBe(true);

        index = 2;
        act(() => {
            ref.current?.handleImageLoaded(index);
        });
        expect(ref.current?.state.loaded[index]).toBe(true);
    });

    test('should handle handleImageProgress', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};
        const {ref} = renderModal(props);

        const index = 1;
        let completedPercentage = 30;
        act(() => {
            ref.current?.setState({loaded: [true, false, false] as any});
            ref.current?.handleImageProgress(index, completedPercentage);
        });

        expect(ref.current?.state.progress[index]).toBe(completedPercentage);

        completedPercentage = 70;
        act(() => {
            ref.current?.handleImageProgress(index, completedPercentage);
        });

        expect(ref.current?.state.progress[index]).toBe(completedPercentage);
    });

    test('should pass componentWillReceiveProps', () => {
        const {ref, rerender} = renderModal();

        expect(Object.keys(ref.current?.state.loaded || {})).toHaveLength(1);
        expect(Object.keys(ref.current?.state.progress || {})).toHaveLength(1);

        act(() => {
            rerender(
                <FilePreviewModal
                    {...baseProps}
                    ref={ref}
                    fileInfos={[
                        TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
                        TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
                        TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
                    ]}
                />,
            );
        });
        expect(Object.keys(ref.current?.state.loaded || {})).toHaveLength(3);
        expect(Object.keys(ref.current?.state.progress || {})).toHaveLength(3);
    });

    test('should match snapshot when plugin overrides the preview component', () => {
        const pluginFilePreviewComponents = [{
            id: generateId(),
            pluginId: 'file-preview',
            override: () => true,
            component: () => <div>{'Preview'}</div>,
        }];
        const props = {...baseProps, pluginFilePreviewComponents};
        const {container} = renderModal(props);
        expect(container).toMatchSnapshot();
    });

    test('should fall back to default preview if plugin does not need to override preview component', () => {
        const pluginFilePreviewComponents = [{
            id: generateId(),
            pluginId: 'file-preview',
            override: () => false,
            component: () => <div>{'Preview'}</div>,
        }];
        const props = {...baseProps, pluginFilePreviewComponents};
        const {container} = renderModal(props);
        expect(container).toMatchSnapshot();
    });
});
