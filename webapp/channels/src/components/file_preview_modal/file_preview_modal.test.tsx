// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import FilePreviewModal, {computeZoomAtCursor} from 'components/file_preview_modal/file_preview_modal';

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

describe('computeZoomAtCursor', () => {
    test('cursor at center yields zero translate when starting from zero', () => {
        const result = computeZoomAtCursor(1, {x: 0, y: 0}, 0, 0, 2);
        expect(result).toEqual({x: 0, y: 0});
    });

    test('zooming in at an off-center cursor shifts translate opposite to the cursor', () => {
        // Cursor 100px right of center, zooming 1 -> 2. The pixel under the cursor
        // must remain under the cursor, so translate must move by -100px on x.
        const result = computeZoomAtCursor(1, {x: 0, y: 0}, 100, 50, 2);
        expect(result).toEqual({x: -100, y: -50});
    });

    test('zooming back to the same scale is a no-op on translate', () => {
        const start = {x: 30, y: -40};
        const result = computeZoomAtCursor(2, start, 75, 25, 2);
        expect(result).toEqual(start);
    });

    test('preserves the pixel under the cursor across a zoom step', () => {
        // The image pixel under the cursor (in local image-center coords) is
        //   p = (cursor - translate) / scale
        // After the new scale + new translate, applying the same transform to p
        // should land back at the cursor position.
        const oldScale = 1.5;
        const oldT = {x: 20, y: -10};
        const cursor = {x: 60, y: 80};
        const newScale = 2.25;
        const px = (cursor.x - oldT.x) / oldScale;
        const py = (cursor.y - oldT.y) / oldScale;

        const newT = computeZoomAtCursor(oldScale, oldT, cursor.x, cursor.y, newScale);

        expect(newT.x + (newScale * px)).toBeCloseTo(cursor.x);
        expect(newT.y + (newScale * py)).toBeCloseTo(cursor.y);
    });

    test('returns the input translate when oldScale is zero (guard)', () => {
        const t = {x: 5, y: 7};
        expect(computeZoomAtCursor(0, t, 10, 10, 2)).toBe(t);
    });
});

describe('FilePreviewModal static helpers', () => {
    test('getDefaultScaleForFile returns the image default for image extensions', () => {
        const png = TestHelper.getFileInfoMock({extension: 'png'});
        expect(FilePreviewModal.getDefaultScaleForFile(png)).toBe(1.0);
    });

    test('getDefaultScaleForFile returns the image default for SVG', () => {
        const svg = TestHelper.getFileInfoMock({extension: 'svg'});
        expect(FilePreviewModal.getDefaultScaleForFile(svg)).toBe(1.0);
    });

    test('getDefaultScaleForFile returns the (PDF) default for other file types', () => {
        const pdf = TestHelper.getFileInfoMock({extension: 'pdf'});
        expect(FilePreviewModal.getDefaultScaleForFile(pdf)).toBe(1.75);
    });

    test('getMaxScaleForFile caps images at 2.0 and other files at 3.0', () => {
        expect(FilePreviewModal.getMaxScaleForFile(TestHelper.getFileInfoMock({extension: 'png'}))).toBe(2.0);
        expect(FilePreviewModal.getMaxScaleForFile(TestHelper.getFileInfoMock({extension: 'svg'}))).toBe(2.0);
        expect(FilePreviewModal.getMaxScaleForFile(TestHelper.getFileInfoMock({extension: 'pdf'}))).toBe(3.0);
    });

    test('getFileIdentity distinguishes FileInfo by id and LinkInfo by link', () => {
        const fileInfo = TestHelper.getFileInfoMock({id: 'abc-123', extension: 'png'});
        const linkInfo = {link: 'https://example.com/x.png', extension: 'png', name: 'x.png'};
        expect(FilePreviewModal.getFileIdentity(fileInfo)).toBe('f:abc-123');
        expect(FilePreviewModal.getFileIdentity(linkInfo as any)).toBe('l:https://example.com/x.png');
    });

    test('getFileIdentity namespaces file ids vs links so a literal collision never compares equal', () => {
        const fileInfo = TestHelper.getFileInfoMock({id: 'shared-value', extension: 'png'});
        const linkInfo = {link: 'shared-value', extension: 'png', name: 'x.png'};
        expect(FilePreviewModal.getFileIdentity(fileInfo)).not.toBe(FilePreviewModal.getFileIdentity(linkInfo as any));
    });
});

describe('FilePreviewModal instance behavior', () => {
    const imageProps = {
        fileInfos: [TestHelper.getFileInfoMock({id: 'img_1', extension: 'png'})],
        startIndex: 0,
        canDownloadFiles: true,
        enablePublicLink: true,
        isMobileView: false,
        post: TestHelper.getPostMock(),
        onExited: jest.fn(),
    };

    const mountModal = (props = imageProps) => {
        const ref = React.createRef<FilePreviewModal>();
        const utils = render(
            <FilePreviewModal
                ref={ref}
                {...props}
            />,
        );
        return {ref, ...utils};
    };

    describe('handleKeyDown', () => {
        test('"+" zooms in and "-" zooms back out for an image', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}});
            });

            act(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', {key: '+'}));
            });
            expect(ref.current?.state.scale[0]).toBeCloseTo(1.25);

            act(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', {key: '-'}));
            });
            expect(ref.current?.state.scale[0]).toBeCloseTo(1.0);
        });

        test('"0" resets a previously zoomed image to default scale', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}, scale: {0: 1.5}});
            });

            act(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', {key: '0'}));
            });
            expect(ref.current?.state.scale[0]).toBe(1.0);
        });

        test('ignores zoom keys when a Ctrl/Cmd modifier is held', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}});
            });

            act(() => {
                document.dispatchEvent(new KeyboardEvent('keydown', {key: '+', ctrlKey: true}));
                document.dispatchEvent(new KeyboardEvent('keydown', {key: '+', metaKey: true}));
            });
            expect(ref.current?.state.scale[0]).toBe(1.0);
        });

        test('ignores zoom keys when an input element has focus', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}});
            });

            const input = document.createElement('input');
            document.body.appendChild(input);
            input.focus();

            act(() => {
                input.dispatchEvent(new KeyboardEvent('keydown', {key: '+', bubbles: true}));
            });
            expect(ref.current?.state.scale[0]).toBe(1.0);

            document.body.removeChild(input);
        });
    });

    describe('handleImageMouseDown drag gate', () => {
        // The drag handler requires DOM-level event listeners to set up; we
        // assert behavior via the resulting React state rather than the
        // private dragState field.
        test('does not start a drag when the image is at default scale', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}});
            });

            const mockEvent = {button: 0, clientX: 0, clientY: 0, preventDefault: jest.fn()} as any;
            act(() => {
                ref.current?.handleImageMouseDown(mockEvent);
            });
            expect(ref.current?.state.isDragging).toBe(false);
        });

        test('starts a drag when the image is zoomed past default scale', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}, scale: {0: 1.5}});
            });

            const mockEvent = {button: 0, clientX: 0, clientY: 0, preventDefault: jest.fn()} as any;
            act(() => {
                ref.current?.handleImageMouseDown(mockEvent);
            });
            expect(ref.current?.state.isDragging).toBe(true);

            // Cleanup: simulate mouseup so the document listeners don't leak
            // between tests.
            act(() => {
                document.dispatchEvent(new MouseEvent('mouseup'));
            });
        });

        test('ignores non-left-button mousedowns', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}, scale: {0: 1.5}});
            });

            const mockEvent = {button: 2, clientX: 0, clientY: 0, preventDefault: jest.fn()} as any;
            act(() => {
                ref.current?.handleImageMouseDown(mockEvent);
            });
            expect(ref.current?.state.isDragging).toBe(false);
        });
    });

    describe('handleImageWheel scale clamping', () => {
        // Use a stable rect for getBoundingClientRect across these tests so the
        // cursor-offset math is predictable.
        const wheelEventOn = (target: HTMLElement, deltaY: number) => {
            const evt = new WheelEvent('wheel', {deltaY, clientX: 100, clientY: 100, cancelable: true});
            Object.defineProperty(evt, 'currentTarget', {value: target, configurable: true});
            return evt;
        };

        test('clamps zoom-in at MAX_SCALE_IMAGE (2.0)', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}, scale: {0: 1.9}});
            });
            const dummy = document.createElement('div');
            jest.spyOn(dummy, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({})});

            act(() => {
                ref.current?.handleImageWheel(wheelEventOn(dummy, -100));

                // A second zoom-in should not push past the cap.
                ref.current?.handleImageWheel(wheelEventOn(dummy, -100));
            });
            expect(ref.current?.state.scale[0]).toBeLessThanOrEqual(2.0);
            expect(ref.current?.state.scale[0]).toBeCloseTo(2.0);
        });

        test('clamps zoom-out at MIN_SCALE (0.25)', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}, scale: {0: 0.3}});
            });
            const dummy = document.createElement('div');
            jest.spyOn(dummy, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({})});

            act(() => {
                ref.current?.handleImageWheel(wheelEventOn(dummy, 100));
                ref.current?.handleImageWheel(wheelEventOn(dummy, 100));
            });
            expect(ref.current?.state.scale[0]).toBeGreaterThanOrEqual(0.25);
            expect(ref.current?.state.scale[0]).toBeCloseTo(0.25);
        });

        test('no-op when deltaY is exactly zero', () => {
            const {ref} = mountModal();
            act(() => {
                ref.current?.setState({showZoomControls: true, loaded: {0: true}, scale: {0: 1.0}});
            });
            const dummy = document.createElement('div');
            jest.spyOn(dummy, 'getBoundingClientRect').mockReturnValue({left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200, x: 0, y: 0, toJSON: () => ({})});

            act(() => {
                ref.current?.handleImageWheel(wheelEventOn(dummy, 0));
            });
            expect(ref.current?.state.scale[0]).toBe(1.0);
        });
    });

    describe('getDerivedStateFromProps identity reconciliation', () => {
        test('resets scale/translate at an index where the file identity changed (same length)', () => {
            const initial = {
                ...imageProps,
                fileInfos: [
                    TestHelper.getFileInfoMock({id: 'a', extension: 'png'}),
                    TestHelper.getFileInfoMock({id: 'b', extension: 'png'}),
                ],
            };
            const {ref, rerender} = mountModal(initial);

            // Simulate the user zooming both images.
            act(() => {
                ref.current?.setState({
                    scale: {0: 1.5, 1: 1.75},
                    translate: {0: {x: 10, y: 10}, 1: {x: 20, y: 20}},
                });
            });

            // Swap the file at index 1 for a different one; index 0 keeps its identity.
            const swapped = {
                ...initial,
                fileInfos: [
                    initial.fileInfos[0],
                    TestHelper.getFileInfoMock({id: 'c', extension: 'png'}),
                ],
            };
            rerender(
                <FilePreviewModal
                    ref={ref}
                    {...swapped}
                />,
            );

            // Index 0 (unchanged identity) keeps its zoom; index 1 (new identity) resets.
            expect(ref.current?.state.scale[0]).toBe(1.5);
            expect(ref.current?.state.translate[0]).toEqual({x: 10, y: 10});
            expect(ref.current?.state.scale[1]).toBe(1.0);
            expect(ref.current?.state.translate[1]).toEqual({x: 0, y: 0});
        });

        test('seeds default scale/translate for brand-new indexes when the list grows', () => {
            const {ref, rerender} = mountModal();
            act(() => {
                ref.current?.setState({scale: {0: 1.5}, translate: {0: {x: 5, y: 5}}});
            });

            const grown = {
                ...imageProps,
                fileInfos: [
                    imageProps.fileInfos[0],
                    TestHelper.getFileInfoMock({id: 'new', extension: 'pdf'}),
                ],
            };
            rerender(
                <FilePreviewModal
                    ref={ref}
                    {...grown}
                />,
            );

            expect(ref.current?.state.scale[0]).toBe(1.5);
            expect(ref.current?.state.scale[1]).toBe(1.75); // pdf default
            expect(ref.current?.state.translate[1]).toEqual({x: 0, y: 0});
        });
    });
});
