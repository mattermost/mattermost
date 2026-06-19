// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import type {NodeViewProps} from '@tiptap/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import {ModalIdentifiers} from 'utils/constants';

import FileAttachmentNodeView from './file_attachment_node_view';

// Mock the utility functions
jest.mock('utils/file_utils', () => ({
    getFileTypeFromMime: jest.fn((mimeType: string) => {
        if (mimeType.includes('pdf')) {
            return 'pdf';
        }
        if (mimeType.includes('word')) {
            return 'word';
        }
        if (mimeType.includes('image')) {
            return 'image';
        }
        return 'other';
    }),
}));

jest.mock('utils/utils', () => ({
    fileSizeToString: jest.fn((size: number) => {
        if (size >= 1024 * 1024) {
            return `${(size / (1024 * 1024)).toFixed(1)} MB`;
        }
        if (size >= 1024) {
            return `${(size / 1024).toFixed(1)} KB`;
        }
        return `${size} B`;
    }),
    getCompassIconClassName: jest.fn(() => 'icon-file-document'),
}));

const mockStore = configureStore([]);

const createMockNodeProps = (
    attrs: Partial<{
        fileId: string | null;
        fileName: string;
        fileSize: number;
        mimeType: string;
        src: string;
        loading: boolean;
    }> = {},
    editorOptions: {isEditable?: boolean} = {isEditable: true},
): NodeViewProps => ({
    node: {
        attrs: {
            fileId: 'file123',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
            src: '/api/v4/files/file123',
            loading: false,
            ...attrs,
        },
    } as any,
    deleteNode: jest.fn(),
    selected: false,
    editor: {
        isEditable: editorOptions.isEditable ?? true,
    } as any,
    getPos: () => 0,
    updateAttributes: jest.fn(),
    extension: {} as any,
    HTMLAttributes: {},
    decorations: [],
    view: {} as any,
    innerDecorations: [] as any,
});

const renderWithProviders = (component: React.ReactElement, store = mockStore({})) => {
    return render(
        <Provider store={store}>
            <IntlProvider
                locale='en'
                messages={{}}
            >
                {component}
            </IntlProvider>
        </Provider>,
    );
};

describe('FileAttachmentNodeView', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('rendering', () => {
        it('renders file name', () => {
            const props = createMockNodeProps({fileName: 'my-document.pdf'});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            expect(screen.getByText('my-document.pdf')).toBeInTheDocument();
        });

        it('renders file size', () => {
            const props = createMockNodeProps({fileSize: 2048});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            expect(screen.getByText('2.0 KB')).toBeInTheDocument();
        });

        it('renders file icon', () => {
            const props = createMockNodeProps({mimeType: 'application/pdf'});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const icon = document.querySelector('.icon-file-document');
            expect(icon).toBeInTheDocument();
        });

        it('renders delete button when editable', () => {
            const props = createMockNodeProps({}, {isEditable: true});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const deleteButton = screen.getByRole('button', {name: /remove/i});
            expect(deleteButton).toBeInTheDocument();
        });

        it('does not render delete button when not editable (view mode)', () => {
            const props = createMockNodeProps({}, {isEditable: false});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const deleteButton = screen.queryByRole('button', {name: /remove/i});
            expect(deleteButton).not.toBeInTheDocument();
        });

        it('renders "Unknown file" when fileName is empty', () => {
            const props = createMockNodeProps({fileName: ''});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            expect(screen.getByText('Unknown file')).toBeInTheDocument();
        });

        it('does not render file size when size is 0', () => {
            const props = createMockNodeProps({fileSize: 0});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            expect(screen.queryByText('0 B')).not.toBeInTheDocument();
        });
    });

    describe('loading state', () => {
        it('renders loading indicator when loading is true', () => {
            const props = createMockNodeProps({loading: true, fileName: 'uploading.pdf'});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            expect(screen.getByText('Uploading...')).toBeInTheDocument();
        });

        it('shows loading spinner icon when loading', () => {
            const props = createMockNodeProps({loading: true});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const spinner = document.querySelector('.icon-loading');
            expect(spinner).toBeInTheDocument();
        });

        it('does not show delete button when loading', () => {
            const props = createMockNodeProps({loading: true});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const deleteButton = screen.queryByRole('button', {name: /remove/i});
            expect(deleteButton).not.toBeInTheDocument();
        });
    });

    describe('selection state', () => {
        it('applies selected class when selected', () => {
            const props: NodeViewProps = {
                ...createMockNodeProps(),
                selected: true,
            };
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const wrapper = document.querySelector('.wiki-file-attachment-wrapper--selected');
            expect(wrapper).toBeInTheDocument();
        });

        it('does not apply selected class when not selected', () => {
            const props = createMockNodeProps();
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const wrapper = document.querySelector('.wiki-file-attachment-wrapper--selected');
            expect(wrapper).not.toBeInTheDocument();
        });
    });

    describe('click interactions', () => {
        it('dispatches openModal action on click', () => {
            const store = mockStore({});
            const props = createMockNodeProps({
                fileId: 'file123',
                fileName: 'document.pdf',
                src: '/api/v4/files/file123',
            });
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            expect(attachment).toBeInTheDocument();
            if (attachment) {
                fireEvent.click(attachment);
            }

            const actions = store.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('MODAL_OPEN');
            expect(actions[0].modalId).toBe(ModalIdentifiers.FILE_PREVIEW_MODAL);
            expect(actions[0].dialogProps.fileInfos[0].id).toBe('file123');
            expect(actions[0].dialogProps.fileInfos[0].name).toBe('document.pdf');
            expect(actions[0].dialogProps.fileInfos[0].extension).toBe('pdf');
        });

        it('does not dispatch action when src is empty', () => {
            const store = mockStore({});
            const props = createMockNodeProps({src: ''});
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            if (attachment) {
                fireEvent.click(attachment);
            }

            const actions = store.getActions();
            expect(actions).toHaveLength(0);
        });

        it('extracts extension from mimeType when fileName has no extension', () => {
            const store = mockStore({});
            const props = createMockNodeProps({
                fileId: 'file456',
                fileName: 'report',
                mimeType: 'application/pdf',
                src: '/api/v4/files/file456',
            });
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            if (attachment) {
                fireEvent.click(attachment);
            }

            const actions = store.getActions();
            expect(actions[0].dialogProps.fileInfos[0].extension).toBe('pdf');
        });

        it('uses link property when fileId is not present', () => {
            const store = mockStore({});
            const props = createMockNodeProps({
                fileId: null,
                fileName: 'external.pdf',
                src: 'https://example.com/file.pdf',
            });
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            if (attachment) {
                fireEvent.click(attachment);
            }

            const actions = store.getActions();
            expect(actions[0].dialogProps.fileInfos[0].id).toBe('');
            expect(actions[0].dialogProps.fileInfos[0].link).toBe('https://example.com/file.pdf');
        });
    });

    describe('keyboard interactions', () => {
        it('dispatches openModal action on Enter key', () => {
            const store = mockStore({});
            const props = createMockNodeProps({
                fileId: 'file123',
                fileName: 'document.pdf',
                src: '/api/v4/files/file123',
            });
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            if (attachment) {
                fireEvent.keyDown(attachment, {key: 'Enter'});
            }

            const actions = store.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('MODAL_OPEN');
        });

        it('dispatches openModal action on Space key', () => {
            const store = mockStore({});
            const props = createMockNodeProps({
                fileId: 'file123',
                fileName: 'document.pdf',
                src: '/api/v4/files/file123',
            });
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            if (attachment) {
                fireEvent.keyDown(attachment, {key: ' '});
            }

            const actions = store.getActions();
            expect(actions).toHaveLength(1);
            expect(actions[0].type).toBe('MODAL_OPEN');
        });

        it('does not dispatch action on other keys', () => {
            const store = mockStore({});
            const props = createMockNodeProps({src: '/api/v4/files/file123'});
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const attachment = document.querySelector('.wiki-file-attachment');
            if (attachment) {
                fireEvent.keyDown(attachment, {key: 'Tab'});
            }

            const actions = store.getActions();
            expect(actions).toHaveLength(0);
        });
    });

    describe('delete functionality', () => {
        it('calls deleteNode when delete button is clicked in edit mode', () => {
            const deleteNode = jest.fn();
            const props: NodeViewProps = {
                ...createMockNodeProps({}, {isEditable: true}),
                deleteNode,
            };
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const deleteButton = screen.getByTitle('Remove attachment');
            fireEvent.click(deleteButton);

            expect(deleteNode).toHaveBeenCalled();
        });

        it('stops event propagation when deleting', () => {
            const store = mockStore({});
            const deleteNode = jest.fn();
            const props: NodeViewProps = {
                ...createMockNodeProps({}, {isEditable: true}),
                deleteNode,
            };
            renderWithProviders(<FileAttachmentNodeView {...props}/>, store);

            const deleteButton = screen.getByTitle('Remove attachment');
            fireEvent.click(deleteButton);

            // Should call deleteNode but not dispatch modal action
            expect(deleteNode).toHaveBeenCalled();
            const actions = store.getActions();
            expect(actions).toHaveLength(0);
        });
    });

    describe('accessibility', () => {
        it('has proper aria-label for remove action when editable', () => {
            const props = createMockNodeProps({fileName: 'my-report.pdf'}, {isEditable: true});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const removeButton = screen.getByLabelText(/remove my-report.pdf/i);
            expect(removeButton).toBeInTheDocument();
        });

        it('main content is focusable with tabIndex', () => {
            const props = createMockNodeProps();
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const attachment = document.querySelector('.wiki-file-attachment');
            expect(attachment).toHaveAttribute('tabIndex', '0');
        });
    });

    describe('title attribute', () => {
        it('shows full file name on hover via title attribute', () => {
            const longFileName = 'very-long-file-name-that-might-be-truncated-in-the-ui.pdf';
            const props = createMockNodeProps({fileName: longFileName});
            renderWithProviders(<FileAttachmentNodeView {...props}/>);

            const nameElement = screen.getByText(longFileName);
            expect(nameElement).toHaveAttribute('title', longFileName);
        });
    });
});
