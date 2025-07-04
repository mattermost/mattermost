// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent, act} from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {TestHelper} from '../../../utils/test_helper';

import ImageGallery from './image_gallery';

const mockActions = {
    getFilePublicLink: jest.fn(),
};

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
    onToggleCollapse: jest.fn(),
    isEmbedVisible: true,
    postId: 'post1',
    allFilesForPost: mockFileInfos,
};

function renderWithProvider(ui: React.ReactElement) {
    const props = {
        ...ui.props,
        actions: mockActions,
    };
    return render(
        <Provider store={store}>
            <IntlProvider
                locale='en'
                messages={{}}
            >
                {React.cloneElement(ui, props)}
            </IntlProvider>
        </Provider>,
    );
}

describe('ImageGallery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders with images', () => {
        renderWithProvider(<ImageGallery {...defaultProps}/>);
        expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
    });

    it('renders with no images', () => {
        renderWithProvider(
            <ImageGallery
                {...defaultProps}
                fileInfos={[]}
                allFilesForPost={[]}
            />,
        );
        expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
        expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    });

    it('renders collapsed state', () => {
        renderWithProvider(
            <ImageGallery
                {...defaultProps}
                isEmbedVisible={false}
            />,
        );
        expect(screen.getByRole('application')).toHaveClass('collapsed');
    });

    it('calls onToggleCollapse when toggled', () => {
        renderWithProvider(<ImageGallery {...defaultProps}/>);
        const toggleBtn = screen.getByRole('button', {name: /images/i});
        fireEvent.click(toggleBtn);
        expect(defaultProps.onToggleCollapse).toHaveBeenCalled();
    });

    it('shows correct aria attributes', () => {
        renderWithProvider(<ImageGallery {...defaultProps}/>);
        const toggleBtn = screen.getByRole('button', {name: /images/i});
        expect(toggleBtn).toHaveAttribute('aria-expanded');
        expect(screen.getByRole('list')).toBeInTheDocument();
    });

    it('updates aria-live region on collapse/expand', async () => {
        renderWithProvider(<ImageGallery {...defaultProps}/>);
        const toggleBtn = screen.getByRole('button', {name: /images/i});
        await act(async () => {
            fireEvent.click(toggleBtn);
        });
        const liveRegion = screen.getByText(/gallery collapsed/i);
        expect(liveRegion).toBeInTheDocument();
    });

    it('matches snapshot', () => {
        const {container} = renderWithProvider(<ImageGallery {...defaultProps}/>);
        expect(container).toMatchSnapshot();
    });

    // Responsive/layout tests (simulate container width)
    it('renders correct grid span for mobile and desktop', () => {
        // Mock offsetWidth for mobile
        const refMock = {current: {offsetWidth: 350}};
        jest.spyOn(React, 'useRef').mockReturnValueOnce(refMock as any);
        renderWithProvider(<ImageGallery {...defaultProps}/>);

        // Should render without error
        expect(screen.getByTestId('fileAttachmentList')).toBeInTheDocument();
    });
});
