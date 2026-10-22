// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {PostAction} from '@mattermost/types/integration_actions';
import type {MessageAttachment as MessageAttachmentType} from '@mattermost/types/message_attachments';
import type {PostImage} from '@mattermost/types/posts';

import MessageAttachment from 'components/post_view/message_attachments/message_attachment/message_attachment';

import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';
import {Constants} from 'utils/constants';

jest.mock('components/external_image', () => {
    return jest.fn((props: any) => <>{props.children(props.src)}</>);
});

jest.mock('components/markdown', () => {
    return jest.fn((props: any) => <div data-testid='markdown-mock'>{props.message}</div>);
});

jest.mock('components/size_aware_image', () => {
    return jest.fn((props: any) => (
        <img
            data-testid='size-aware-image-mock'
            className={props.className}
            src={props.src}
            onClick={(e: React.MouseEvent<HTMLImageElement>) => props.onClick?.(e, props.src)}
        />
    ));
});

jest.mock('../action_button', () => {
    return jest.fn((props: any) => (
        <button
            data-testid='action-button-mock'
            data-action-id={props.action.id}
            data-action-cookie={props.action.cookie}
            onClick={(e: React.MouseEvent) => props.handleAction(e, props.action.options)}
        >
            {props.action.name}
        </button>
    ));
});

jest.mock('../action_menu', () => {
    return jest.fn((props: any) => (
        <div data-testid='action-menu-mock'>{props.action.name}</div>
    ));
});

describe('components/post_view/MessageAttachment', () => {
    const attachment = {
        pretext: 'pretext',
        author_name: 'author_name',
        author_icon: 'author_icon',
        author_link: 'author_link',
        title: 'title',
        title_link: 'title_link',
        text: 'short text',
        image_url: 'image_url',
        thumb_url: 'thumb_url',
        color: '#FFF',
        footer: 'footer',
        footer_icon: 'footer_icon',
    } as MessageAttachmentType;

    const baseProps = {
        postId: 'post_id',
        attachment,
        currentRelativeTeamUrl: 'dummy_team',
        actions: {
            doPostActionWithCookie: jest.fn(),
            openModal: jest.fn(),
        },
        imagesMetadata: {
            image_url: {
                height: 200,
                width: 200,
            } as PostImage,
            thumb_url: {
                height: 200,
                width: 200,
            } as PostImage,
        } as Record<string, PostImage>,
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<MessageAttachment {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('should change checkOverflow state on handleHeightReceived change', () => {
        // Mock Markdown to capture imageProps
        const MarkdownMock = jest.requireMock('components/markdown');
        MarkdownMock.mockClear();

        renderWithContext(<MessageAttachment {...baseProps}/>);

        // Find the Markdown call that has imageProps (the attachment text one)
        const callWithImageProps = MarkdownMock.mock.calls.find(
            (call: any) => call[0].imageProps,
        );
        expect(callWithImageProps).toBeDefined();

        const imageProps = callWithImageProps[0].imageProps;
        const callCountBefore = MarkdownMock.mock.calls.length;

        // Call onImageLoaded with height > 0 (triggers checkPostOverflow)
        act(() => {
            imageProps.onImageLoaded(1);
        });

        // Component should re-render
        expect(MarkdownMock.mock.calls.length).toBeGreaterThan(callCountBefore);

        // Call onImageLoaded with height 0 (should NOT trigger checkPostOverflow)
        const callCountAfter = MarkdownMock.mock.calls.length;
        act(() => {
            imageProps.onImageLoaded(0);
        });

        // No additional re-render
        expect(MarkdownMock.mock.calls.length).toEqual(callCountAfter);
    });

    test('should match value on renderPostActions', () => {
        // Without actions - no action buttons should render
        const {container, unmount} = renderWithContext(<MessageAttachment {...baseProps}/>);
        expect(container.querySelector('.attachment-actions')).not.toBeInTheDocument();

        unmount();

        // With actions
        const newAttachment = {
            ...attachment,
            actions: [
                {id: 'action_id_1', name: 'action_name_1'},
                {id: 'action_id_2', name: 'action_name_2'},
                {id: 'action_id_3', name: 'action_name_3', type: 'select', data_source: 'users'},
            ],
        };

        const props = {...baseProps, attachment: newAttachment};
        const {container: container2} = renderWithContext(<MessageAttachment {...props}/>);

        // Should render action buttons and action menu
        expect(container2.querySelector('.attachment-actions')).toBeInTheDocument();
        expect(screen.getAllByTestId('action-button-mock')).toHaveLength(2);
        expect(screen.getByTestId('action-menu-mock')).toBeInTheDocument();
        expect(container2.querySelector('.attachment-actions')).toMatchSnapshot();
    });

    test('should call actions.doPostActionWithCookie on handleAction', async () => {
        const promise = Promise.resolve({data: 123});
        const doPostActionWithCookie = jest.fn(() => promise);
        const openModal = jest.fn();
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal}, attachment: newAttachment};
        const {container} = renderWithContext(<MessageAttachment {...props}/>);
        expect(container).toMatchSnapshot();

        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.click(screen.getByTestId('action-button-mock'));

        expect(doPostActionWithCookie).toHaveBeenCalledTimes(1);
        expect(doPostActionWithCookie).toHaveBeenCalledWith(props.postId, actionId, 'cookie-contents');
    });

    test('should call openModal when showModal is called', async () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                image_url: 'https://example.com/image.png',
            } as MessageAttachmentType,
            imagesMetadata: {
                ...baseProps.imagesMetadata,
                'https://example.com/image.png': {height: 200, width: 200} as PostImage,
            },
        };
        renderWithContext(<MessageAttachment {...props}/>);

        // Click on the image to trigger showModal
        const {userEvent} = await import('tests/react_testing_utils');
        const images = screen.getAllByTestId('size-aware-image-mock');
        const attachmentImage = images.find((img) => img.getAttribute('src') === 'https://example.com/image.png');
        expect(attachmentImage).toBeDefined();
        await userEvent.click(attachmentImage!);

        expect(props.actions.openModal).toHaveBeenCalledTimes(1);
    });

    test('should match value on getFieldsTable', () => {
        // Without fields - no field table should render
        const {container, unmount} = renderWithContext(<MessageAttachment {...baseProps}/>);
        expect(container.querySelector('.attachment-fields')).not.toBeInTheDocument();

        unmount();

        // With fields
        const newAttachment = {
            ...attachment,
            fields: [
                {title: 'title_1', value: 'value_1', short: false},
                {title: 'title_2', value: 'value_2', short: false},
            ],
        };

        const props = {...baseProps, attachment: newAttachment};
        const {container: container2} = renderWithContext(<MessageAttachment {...props}/>);

        const fieldTables = container2.querySelectorAll('.attachment-fields');
        expect(fieldTables.length).toBeGreaterThan(0);
        expect(container2.querySelector('.attachment-fields')!.parentElement).toMatchSnapshot();
    });

    test('should use ExternalImage for images', () => {
        const ExternalImageMock = jest.requireMock('components/external_image');
        ExternalImageMock.mockClear();

        const props = {
            ...baseProps,
            attachment: {
                author_icon: 'http://example.com/author.png',
                image_url: 'http://example.com/image.png',
                thumb_url: 'http://example.com/thumb.png',

                // footer_icon is only rendered if footer is provided
                footer: attachment.footer,
                footer_icon: 'http://example.com/footer.png',
            } as MessageAttachmentType,
        };

        renderWithContext(<MessageAttachment {...props}/>);

        // ExternalImage should have been called 4 times
        expect(ExternalImageMock).toHaveBeenCalledTimes(4);

        const srcValues = ExternalImageMock.mock.calls.map((call: any) => call[0].src);
        expect(srcValues).toContain(props.attachment.author_icon);
        expect(srcValues).toContain(props.attachment.image_url);
        expect(srcValues).toContain(props.attachment.footer_icon);
        expect(srcValues).toContain(props.attachment.thumb_url);
    });

    test('should decode HTML entities in title when title_link is present', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                title: 'Meeting &#40;Q1 Review&#41; &amp; Planning',
                title_link: 'https://example.com/meeting',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);
        const titleLink = container.querySelector('.attachment__title-link');
        expect(titleLink).toBeInTheDocument();
        expect(titleLink).toHaveTextContent('Meeting (Q1 Review) & Planning');
    });

    test('should decode HTML entities in author_name', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                author_name: 'Bot &#40;v2&#41;',
                author_icon: undefined,
                author_link: undefined,
            } as unknown as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);
        const authorName = container.querySelector('.attachment__author-name');
        expect(authorName).toBeInTheDocument();
        expect(authorName).toHaveTextContent('Bot (v2)');
    });

    test('should match snapshot when the attachment has an emoji in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like :pizza:?',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the attachment hasn\'t any emojis in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Don\'t you like emojis?',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the attachment has a link in the title', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'Do you like https://mattermost.com?',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when no footer is provided (even if footer_icon is provided)', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                footer: '',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot when the footer is truncated', () => {
        const props = {
            ...baseProps,
            attachment: {
                title: 'footer',
                footer: 'a'.repeat(Constants.MAX_ATTACHMENT_FOOTER_LENGTH + 1),
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot and render a field with a number value', () => {
        const props = {
            ...baseProps,
            attachment: {
                ...attachment,
                fields: [
                    {
                        title: 'this is the title',
                        value: 1234,
                    },
                ],
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        expect(container.querySelector('.attachment-field')).toMatchSnapshot();
    });

    test('should not render content box if there is no content', () => {
        const props = {
            ...baseProps,
            attachment: {
                pretext: 'This is a pretext.',
            } as MessageAttachmentType,
        };

        const {container} = renderWithContext(<MessageAttachment {...props}/>);
        expect(container.querySelector('.attachment')).toMatchSnapshot();
    });

    test('should handle action errors and display error message', async () => {
        const errorMessage = 'Action failed to execute';
        const doPostActionWithCookie = jest.fn().mockResolvedValue({
            error: {message: errorMessage},
        });
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal: jest.fn()}, attachment: newAttachment};
        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        // Initially no error should be shown
        expect(container.querySelector('.has-error')).not.toBeInTheDocument();

        // Trigger action by clicking the button
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.click(screen.getByTestId('action-button-mock'));

        // Error should now be displayed
        await waitFor(() => {
            expect(container.querySelector('.has-error')).toBeInTheDocument();
        });
        expect(container.querySelector('.control-label')?.textContent).toBe(errorMessage);
    });

    test('should handle promise rejection errors', async () => {
        const errorMessage = 'Network error occurred';
        const doPostActionWithCookie = jest.fn().mockRejectedValue(new Error(errorMessage));
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal: jest.fn()}, attachment: newAttachment};
        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        // Initially no error should be shown
        expect(container.querySelector('.has-error')).not.toBeInTheDocument();

        // Trigger action
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.click(screen.getByTestId('action-button-mock'));

        // Error should now be displayed
        await waitFor(() => {
            expect(container.querySelector('.has-error')).toBeInTheDocument();
        });
        expect(container.querySelector('.control-label')?.textContent).toBe(errorMessage);
    });

    test('should clear previous errors when new action is triggered', async () => {
        const doPostActionWithCookie = jest.fn().
            mockResolvedValueOnce({error: {message: 'Previous error'}}).
            mockResolvedValueOnce({data: 'success'});
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal: jest.fn()}, attachment: newAttachment};
        const {container} = renderWithContext(<MessageAttachment {...props}/>);

        // Trigger first action that causes an error
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.click(screen.getByTestId('action-button-mock'));

        // Wait for error to appear
        await waitFor(() => {
            expect(container.querySelector('.has-error')).toBeInTheDocument();
        });

        // Trigger new action that succeeds
        await userEvent.click(screen.getByTestId('action-button-mock'));

        // Error should be cleared on successful action
        await waitFor(() => {
            expect(container.querySelector('.has-error')).not.toBeInTheDocument();
        });
    });

    test('should render error message with default text when no error message provided', async () => {
        const doPostActionWithCookie = jest.fn().mockResolvedValue({
            error: {}, // Error object without message
        });
        const actionId = 'action_id_1';
        const newAttachment = {
            ...attachment,
            actions: [{id: actionId, name: 'action_name_1', cookie: 'cookie-contents'}] as PostAction[],
        };
        const props = {...baseProps, actions: {doPostActionWithCookie, openModal: jest.fn()}, attachment: newAttachment};
        renderWithContext(<MessageAttachment {...props}/>);

        // Trigger action
        const {userEvent} = await import('tests/react_testing_utils');
        await userEvent.click(screen.getByTestId('action-button-mock'));

        // Should show default error message
        await waitFor(() => {
            expect(screen.getByText('Action failed to execute')).toBeInTheDocument();
        });
    });
});
