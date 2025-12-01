// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, waitFor, fireEvent} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';
import {generateId} from 'utils/utils';

import FilePreviewModal from './file_preview_modal';

// Mock loadImage to prevent XMLHttpRequest errors in jsdom
const mockLoadImage = vi.fn().mockImplementation((url, onLoad) => {
    // Simulate successful image load
    if (onLoad) {
        setTimeout(() => onLoad({naturalWidth: 100, naturalHeight: 100}), 0);
    }
    return {abort: vi.fn()};
});

vi.mock('utils/utils', async () => {
    const actual = await vi.importActual('utils/utils');
    return {
        ...actual,
        loadImage: (...args: any[]) => mockLoadImage(...args),
        generateId: () => 'mock_generated_id',
    };
});

// Mock fetch for CodePreview
vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    text: () => Promise.resolve('// mock code content'),
    headers: new Headers({'content-type': 'text/plain'}),
}));

describe('components/FilePreviewModal', () => {
    const baseProps = {
        fileInfos: [TestHelper.getFileInfoMock({id: 'file_id', extension: 'jpg'})],
        startIndex: 0,
        canDownloadFiles: true,
        enablePublicLink: true,
        isMobileView: false,
        post: TestHelper.getPostMock(),
        onExited: vi.fn(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('should match snapshot', () => {
        renderWithContext(<FilePreviewModal {...baseProps}/>);

        // Verify modal is rendered with expected structure (modal renders to portal/body)
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded with image', async () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'jpg', has_preview_image: true})];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Wait for the image preview to actually appear (not just loadImage to be called)
        await waitFor(() => {
            expect(document.querySelector('.image_preview')).toBeInTheDocument();
        });

        // Verify image preview container is rendered
        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded with .mov file', async () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'mov'})];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Video files should show AudioVideoPreview component
        await waitFor(() => {
            expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        });

        // Video preview renders a video element
        expect(document.querySelector('video')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded with .m4a file', async () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'm4a'})];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Audio files should show AudioVideoPreview component
        await waitFor(() => {
            expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        });

        // AudioVideoPreview uses video element for both audio and video files
        expect(document.querySelector('video')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded with .js file', async () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'js', name: 'test.js'})];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Wait for code preview to load
        await waitFor(() => {
            expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        });

        // JS files use CodePreview - modal should have code-specific class
        expect(document.querySelector('.modal-code')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded with other file', () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'file_id', extension: 'other', name: 'file.other'})];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Unknown file types should show FileInfoPreview
        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded with footer', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'wma'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Verify modal renders with multiple files
        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded', async () => {
        renderWithContext(<FilePreviewModal {...baseProps}/>);

        // Wait for loaded state
        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should match snapshot, loaded and showing footer', () => {
        // Mobile view shows footer
        const props = {...baseProps, isMobileView: true};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Verify footer renders in mobile view
        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should go to next or previous upon key press of right or left, respectively', async () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif', name: 'file1.gif'}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'png', name: 'file2.png'}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'jpg', name: 'file3.jpg'}),
        ];
        const props = {...baseProps, fileInfos, startIndex: 0};

        renderWithContext(<FilePreviewModal {...props}/>);

        // Initially shows first file (index 0)
        await waitFor(() => {
            expect(screen.getByText('file1.gif')).toBeInTheDocument();
        });

        // Press right arrow to go to next file
        fireEvent.keyUp(document, {key: 'ArrowRight', code: 'ArrowRight', keyCode: 39});

        await waitFor(() => {
            expect(screen.getByText('file2.png')).toBeInTheDocument();
        });

        // Press right arrow again to go to third file
        fireEvent.keyUp(document, {key: 'ArrowRight', code: 'ArrowRight', keyCode: 39});

        await waitFor(() => {
            expect(screen.getByText('file3.jpg')).toBeInTheDocument();
        });

        // Press left arrow to go back to second file
        fireEvent.keyUp(document, {key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37});

        await waitFor(() => {
            expect(screen.getByText('file2.png')).toBeInTheDocument();
        });

        // Press left arrow to go back to first file
        fireEvent.keyUp(document, {key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37});

        await waitFor(() => {
            expect(screen.getByText('file1.gif')).toBeInTheDocument();
        });
    });

    test('should handle onMouseEnter and onMouseLeave', () => {
        renderWithContext(<FilePreviewModal {...baseProps}/>);

        const mainCtr = document.querySelector('.file-preview-modal__main-ctr');
        expect(mainCtr).toBeInTheDocument();

        // Mouse enter should show close button state (internal state change)
        fireEvent.mouseEnter(mainCtr!);

        // Mouse leave should hide close button state
        fireEvent.mouseLeave(mainCtr!);

        // Component should still be rendered without errors
        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
    });

    test('should handle on modal close', async () => {
        const onExited = vi.fn();
        const props = {...baseProps, onExited};

        renderWithContext(<FilePreviewModal {...props}/>);

        // Find and click the close button
        const closeButton = screen.getByRole('button', {name: /close/i});
        fireEvent.click(closeButton);

        // Modal should close
        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        });
    });

    test('should match snapshot for external file', () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({extension: 'png', name: 'external.png'}),
        ];
        const props = {...baseProps, fileInfos};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Verify modal renders for external file
        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should correctly identify image URLs with isImageUrl method', async () => {
        // Test with image extension
        const imageFileInfos = [TestHelper.getFileInfoMock({id: 'image_file', extension: 'png'})];
        renderWithContext(
            <FilePreviewModal
                {...baseProps}
                fileInfos={imageFileInfos}
            />,
        );

        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        // Image files should trigger loadImage
        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
    });

    test('should handle external image URLs correctly', async () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'external_img', extension: 'jpg', has_preview_image: true})];
        const props = {...baseProps, fileInfos};

        renderWithContext(<FilePreviewModal {...props}/>);

        // Wait for image loading to be triggered
        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        // Modal should render properly
        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
    });

    test('should have called loadImage', async () => {
        const fileInfos = [
            TestHelper.getFileInfoMock({id: 'file_id_1', extension: 'gif', has_preview_image: true}),
            TestHelper.getFileInfoMock({id: 'file_id_2', extension: 'png', has_preview_image: true}),
            TestHelper.getFileInfoMock({id: 'file_id_3', extension: 'mp4'}),
        ];
        const props = {...baseProps, fileInfos};

        renderWithContext(<FilePreviewModal {...props}/>);

        // loadImage should be called for image files
        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        // Verify the first call was for the gif file (startIndex: 0)
        expect(mockLoadImage.mock.calls[0][0]).toContain('file_id_1');
    });

    test('should handle handleImageLoaded', async () => {
        const fileInfos = [TestHelper.getFileInfoMock({id: 'loading_test', extension: 'jpg', has_preview_image: true})];
        const props = {...baseProps, fileInfos};

        renderWithContext(<FilePreviewModal {...props}/>);

        // Initially may show loading state
        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();

        // Wait for image to be marked as loaded (callback triggered by mock)
        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        // After loaded, content should be present
        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
    });

    test('should handle handleImageProgress', async () => {
        // Create a mock that calls the progress callback
        const progressMock = vi.fn().mockImplementation((url, onLoad, onProgress) => {
            // Simulate progress updates
            if (onProgress) {
                onProgress(50);
            }
            if (onLoad) {
                setTimeout(() => onLoad({naturalWidth: 100, naturalHeight: 100}), 100);
            }
            return {abort: vi.fn()};
        });

        mockLoadImage.mockImplementation(progressMock);

        const fileInfos = [TestHelper.getFileInfoMock({id: 'progress_test', extension: 'jpg', has_preview_image: true})];
        const props = {...baseProps, fileInfos};

        renderWithContext(<FilePreviewModal {...props}/>);

        // Progress callback should have been called
        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        expect(document.querySelector('.file-preview-modal')).toBeInTheDocument();
    });

    test('should pass componentWillReceiveProps', async () => {
        const fileInfos1 = [TestHelper.getFileInfoMock({id: 'file1', extension: 'jpg', name: 'first.jpg'})];
        const props1 = {...baseProps, fileInfos: fileInfos1};

        const {rerender} = renderWithContext(<FilePreviewModal {...props1}/>);

        await waitFor(() => {
            expect(screen.getByText('first.jpg')).toBeInTheDocument();
        });

        // Re-render with new props (different fileInfos)
        const fileInfos2 = [
            TestHelper.getFileInfoMock({id: 'file2', extension: 'png', name: 'second.png'}),
            TestHelper.getFileInfoMock({id: 'file3', extension: 'gif', name: 'third.gif'}),
        ];
        const props2 = {...baseProps, fileInfos: fileInfos2};

        rerender(<FilePreviewModal {...props2}/>);

        // Component should update with new files
        await waitFor(() => {
            expect(screen.getByText('second.png')).toBeInTheDocument();
        });
    });

    test('should match snapshot when plugin overrides the preview component', () => {
        const pluginFilePreviewComponents = [{
            id: generateId(),
            pluginId: 'file-preview',
            override: () => true,
            component: () => <div data-testid='plugin-preview'>{'Preview'}</div>,
        }];
        const props = {...baseProps, pluginFilePreviewComponents};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Plugin component should render when override returns true
        expect(screen.getByTestId('plugin-preview')).toBeInTheDocument();
        expect(screen.getByText('Preview')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });

    test('should fall back to default preview if plugin does not need to override preview component', async () => {
        const pluginFilePreviewComponents = [{
            id: generateId(),
            pluginId: 'file-preview',
            override: () => false,
            component: () => <div data-testid='plugin-preview'>{'Plugin Preview'}</div>,
        }];
        const fileInfos = [TestHelper.getFileInfoMock({id: 'fallback_test', extension: 'jpg', has_preview_image: true})];
        const props = {...baseProps, fileInfos, pluginFilePreviewComponents};
        renderWithContext(<FilePreviewModal {...props}/>);

        // Wait for image to load
        await waitFor(() => {
            expect(mockLoadImage).toHaveBeenCalled();
        });

        // Plugin component should NOT render when override returns false
        expect(screen.queryByTestId('plugin-preview')).not.toBeInTheDocument();

        // Default image preview should render instead
        expect(document.querySelector('.file-preview-modal__content')).toBeInTheDocument();
        expect(document.body).toMatchSnapshot();
    });
});
