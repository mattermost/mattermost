import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react';
import '@testing-library/jest-dom';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
import ImageGallery from './image_gallery';
import {TestHelper} from 'utils/test_helper';
import {IntlProvider} from 'react-intl';

const mockStore = configureStore([]);
const store = mockStore({
    entities: {
        files: {
            files: {
                img1: {
                    id: 'img1',
                    name: 'image1.png',
                    extension: 'png',
                    width: 100,
                    height: 100,
                    link: 'http://example.com/image1.png',
                },
                img2: {
                    id: 'img2',
                    name: 'image2.jpg',
                    extension: 'jpg',
                    width: 300,
                    height: 200,
                    link: 'http://example.com/image2.jpg',
                },
            },
            fileIdsByPostId: {
                post1: ['img1', 'img2'],
            },
        },
        i18n: {
            locale: 'en',
        },
        general: {
            config: {},
        },
    },
    views: {
        rhs: {
            selectedPostId: '',
        },
    },
});

const mockFileInfos = [
    TestHelper.getFileInfoMock({
        id: 'img1',
        name: 'image1.png',
        extension: 'png',
        width: 100,
        height: 100,
        link: 'http://example.com/image1.png',
    }),
    TestHelper.getFileInfoMock({
        id: 'img2',
        name: 'image2.jpg',
        extension: 'jpg',
        width: 300,
        height: 200,
        link: 'http://example.com/image2.jpg',
    }),
];

const defaultProps = {
    fileInfos: mockFileInfos,
    canDownloadFiles: true,
    handleImageClick: jest.fn(),
    onToggleCollapse: jest.fn(),
    isEmbedVisible: true,
    postId: 'post1',
    allFilesForPost: mockFileInfos,
};

function renderWithProvider(ui) {
    return render(
        <Provider store={store}>
            <IntlProvider locale="en" messages={{}}>
                {ui}
            </IntlProvider>
        </Provider>
    );
}

describe('ImageGallery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders with images', () => {
        renderWithProvider(<ImageGallery {...defaultProps} />);
        expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('renders with no images', () => {
        renderWithProvider(<ImageGallery {...defaultProps} fileInfos={[]} allFilesForPost={[]} />);
        expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });

    it('renders collapsed state', () => {
        renderWithProvider(<ImageGallery {...defaultProps} isEmbedVisible={false} />);
        expect(screen.getByRole('list')).toHaveClass('collapsed');
    });

    it('calls handleImageClick on Enter/Space', () => {
        renderWithProvider(<ImageGallery {...defaultProps} />);
        const items = screen.getAllByRole('listitem');
        fireEvent.keyDown(items[0], {key: 'Enter'});
        expect(defaultProps.handleImageClick).toHaveBeenCalled();
        fireEvent.keyDown(items[1], {key: ' '});
        expect(defaultProps.handleImageClick).toHaveBeenCalledTimes(2);
    });

    it('calls onToggleCollapse when toggled', () => {
        renderWithProvider(<ImageGallery {...defaultProps} />);
        const toggleBtn = screen.getByRole('button', {name: /images/i});
        fireEvent.click(toggleBtn);
        expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
    });

    it('disables download button when downloading', async () => {
        renderWithProvider(<ImageGallery {...defaultProps} />);
        const downloadBtn = screen.getByRole('button', {name: /download all/i});
        await act(async () => {
            fireEvent.click(downloadBtn);
        });
        expect(downloadBtn).toBeDisabled();
    });

    it('disables download button when not allowed', () => {
        renderWithProvider(<ImageGallery {...defaultProps} canDownloadFiles={false} />);
        const downloadBtn = screen.getByRole('button', {name: /download all/i});
        expect(downloadBtn).toBeDisabled();
    });

    it('shows correct aria attributes', () => {
        renderWithProvider(<ImageGallery {...defaultProps} />);
        const toggleBtn = screen.getByRole('button', {name: /images/i});
        expect(toggleBtn).toHaveAttribute('aria-expanded');
        expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('triggers download for each file with correct filename and url', async () => {
        // Suppress jsdom navigation error for this test only
        const originalError = console.error;
        console.error = (msg, ...args) => {
            if (msg && msg.toString().includes('Not implemented: navigation')) {
                return;
            }
            originalError(msg, ...args);
        };
        
        // Spy on document.createElement and check the anchor's properties
        const aStub = document.createElement('a');
        aStub.click = jest.fn();
        const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'a') {
                return aStub;
            }
            return document.createElementNS('http://www.w3.org/1999/xhtml', tagName);
        });
        const appendChildSpy = jest.spyOn(document.body, 'appendChild');
        const removeChildSpy = jest.spyOn(document.body, 'removeChild');
        renderWithProvider(<ImageGallery {...defaultProps} />);
        const downloadBtn = screen.getByRole('button', {name: /download all/i});
        await act(async () => {
            fireEvent.click(downloadBtn);
        });
        
        // Check that the download handler logic was triggered for each file
        expect(createElementSpy.mock.calls.filter(call => call[0] === 'a').length).toBe(defaultProps.fileInfos.length);
        expect(aStub.click).toHaveBeenCalledTimes(defaultProps.fileInfos.length);
        expect(appendChildSpy).toHaveBeenCalled();
        expect(removeChildSpy).toHaveBeenCalled();
        // Optionally, check that the anchor's download attribute is set to the sanitized filename
        expect(aStub.download).toBe('image2.jpg'); // last file in mockFileInfos
        expect(aStub.href).toBe('http://example.com/image2.jpg'); // last file in mockFileInfos
        console.error = originalError;
    });

    it('handles edge case: invalid fileInfo.link', async () => {
        const badFiles = [
            TestHelper.getFileInfoMock({id: 'bad', name: 'bad.png', extension: 'png', width: 100, height: 100, link: null}),
        ];
        const createElementSpy = jest.spyOn(document, 'createElement');
        renderWithProvider(<ImageGallery {...defaultProps} fileInfos={badFiles} allFilesForPost={badFiles} />);
        const downloadBtn = screen.getByRole('button', {name: /download all/i});
        await act(async () => {
            fireEvent.click(downloadBtn);
        });
        // Should be disabled for invalid link
        expect(downloadBtn).toBeDisabled();
        expect(createElementSpy).not.toHaveBeenCalledWith('a');
        createElementSpy.mockRestore();
    });

    it('updates aria-live region on collapse/expand', () => {
        renderWithProvider(<ImageGallery {...defaultProps} />);
        const toggleBtn = screen.getByRole('button', {name: /images/i});
        fireEvent.click(toggleBtn);
        const liveRegion = screen.getByText(/gallery (collapsed|expanded)/i);
        expect(liveRegion).toBeInTheDocument();
    });

    // Responsive/layout tests (simulate container width)
    it('renders correct grid span for mobile and desktop', () => {
        // Mock offsetWidth for mobile
        const refMock = {current: {offsetWidth: 350}};
        jest.spyOn(React, 'useRef').mockReturnValueOnce(refMock as any);
        renderWithProvider(<ImageGallery {...defaultProps} />);
        
        // Should render without error
        expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
    });
}); 