// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {CustomEmoji} from '@mattermost/types/emojis';
import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import EmojiMap from 'utils/emoji_map';
import {TestHelper} from 'utils/test_helper';

import AddEmoji from './add_emoji';
import type {AddEmojiProps} from './add_emoji';

const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAABICAYAAABV7bNHAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAB3R' +
    'JTUUH4AcXEyomBnhW6AAAAm9JREFUeNrtnL9vEmEcxj9cCDUSIVhNgGjaTUppOmjrX1BNajs61n+hC5MMrQNOLE7d27GjPxLs0JmSDk2VYNLBCw0yCA0mOBATHXghVu4wYeHCPc' +
    '94711y30/e732f54Y3sLBbxEUxYAtYA5aB+0yXasAZcAQcAFdON1kuD+eBBvAG2JhCOJiaNkyNDVPzfwGlgBPgJRDCPwqZmk8MA0dAKeAjsIJ/tWIYpJwA7U9pK43Tevv/Asr7f' +
    'Oc47aR8H1AMyIrJkLJAzDKjPCQejh/uLcv4HMlZa5YxgZKzli1NrtETzRKD0RIgARIgARIgARIgAfKrgl54iUwiwrOlOHOzYQDsZof35w0+ffshQJlEhJ3NxWvX7t66waP5WV69' +
    '/TxxSBNvsecP74215htA83fCrmv9lvM1oJsh9y4PzwQFqFJvj7XmG0AfzhtjrfkGUMlusXd8gd3sDK7ZzQ57xxeU7NbEAQUWdou/ZQflpAVIgPycxR7P3WbdZLHwTJBKvc3h6aU' +
    'nspjlBTjZpw9IJ6MDY5hORtnZXCSTiAjQ+lJcWWyU0smostjYJi2gKTYyb3393hGgUXnr8PRSgEp2i0LxC5V6m5/dX4Nd5YW/iZ7xQSW75YlgKictQAKkLKYspiymLKYspiymLK' +
    'YspiymLCYnraghQAIkCZAACZAACZDHAdWEwVU1i94RMZKzzix65+dIzjqy6B0u1BWLIXWBA4veyUsF8RhSAbjqT7EcUBaTgcqGybUx/0ITrTe5DIshH1QFnvh8J5UNg6qbUawCq' +
    '8Brn324u6bm1b/hjHLSOSAObAPvprT1aqa2bVNrzemmPw4OwJf+E7QCAAAAAElFTkSuQmCC';

let mockFileReaderInstance: any;
function setupFileReaderMock(result: string | ArrayBuffer | null) {
    Object.defineProperty(global, 'FileReader', {
        writable: true,
        value: jest.fn().mockImplementation(() => {
            mockFileReaderInstance = {
                readAsDataURL: jest.fn(function() {
                    if (mockFileReaderInstance.onload) {
                        mockFileReaderInstance.onload();
                    }
                }),
                result,
                onload: null,
            };
            return mockFileReaderInstance;
        }),
    });
}

describe('components/emoji/components/AddEmoji', () => {
    const baseProps: AddEmojiProps = {
        emojiMap: new EmojiMap(new Map([['mycustomemoji', TestHelper.getCustomEmojiMock({name: 'mycustomemoji'})]])),
        team: {
            id: 'team-id',
        } as Team,
        user: {
            id: 'current-user-id',
        } as UserProfile,
        actions: {
            createCustomEmoji: jest.fn().mockImplementation((emoji: CustomEmoji) => ({data: {name: emoji.name}})),
        },
    };

    beforeEach(() => {
        (baseProps.actions.createCustomEmoji as jest.Mock).mockClear();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);
        expect(container).toMatchSnapshot();

        const nameInput = screen.getByRole('textbox');
        expect(nameInput).toHaveValue('');

        // No preview should be shown when imageUrl is empty
        expect(screen.queryByText('Preview')).not.toBeInTheDocument();

        // No file selected
        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        expect(fileInput).toBeInTheDocument();
    });

    test('should update emoji name and match snapshot', async () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'emojiName');
        expect(nameInput).toHaveValue('emojiName');
        expect(container).toMatchSnapshot();
    });

    test('should select a file and match snapshot', async () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;

        // Empty file change should not trigger FileReader
        fireEvent.change(fileInput, {target: {files: []}});
        expect(FileReader).not.toHaveBeenCalled();
        expect(screen.queryByText('Preview')).not.toBeInTheDocument();

        // File change with a file should trigger FileReader
        await userEvent.upload(fileInput, file);
        expect(FileReader).toHaveBeenCalled();
        expect(mockFileReaderInstance.readAsDataURL).toHaveBeenCalledWith(file);

        // Preview should now be visible
        expect(screen.getByText('Preview')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    test('should submit the new added emoji', async () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const nameInput = screen.getByRole('textbox');
        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;

        await userEvent.type(nameInput, 'emojiName');
        await userEvent.upload(fileInput, file);

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).toHaveBeenCalled();

        // No error should be shown
        expect(screen.queryByText('A name is required for the emoji')).not.toBeInTheDocument();
        expect(screen.queryByText(/An emoji's name can only contain/)).not.toBeInTheDocument();
    });

    test('should not submit when already saving', async () => {
        const neverResolvingMock = jest.fn().mockImplementation(() => new Promise(() => {}));
        const props: AddEmojiProps = {
            ...baseProps,
            actions: {
                createCustomEmoji: neverResolvingMock,
            },
        };

        const {container} = renderWithContext(<AddEmoji {...props}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const nameInput = screen.getByRole('textbox');
        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;

        await userEvent.type(nameInput, 'emojiName');
        await userEvent.upload(fileInput, file);

        const saveButton = screen.getByTestId('save-button');

        // First submit - this will set saving=true and remain so (never-resolving promise)
        await userEvent.click(saveButton);
        expect(neverResolvingMock).toHaveBeenCalledTimes(1);

        // Second submit - should not call createCustomEmoji again because saving is already true
        await userEvent.click(saveButton);
        expect(neverResolvingMock).toHaveBeenCalledTimes(1);

        // No error should be shown
        expect(screen.queryByText('A name is required for the emoji')).not.toBeInTheDocument();
    });

    test('should show error if emoji name unset', async () => {
        renderWithContext(<AddEmoji {...baseProps}/>);

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(screen.getByText('A name is required for the emoji')).toBeInTheDocument();
        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test('should show error if image unset', async () => {
        renderWithContext(<AddEmoji {...baseProps}/>);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'emojiName');

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(screen.getByText('An image is required for the emoji')).toBeInTheDocument();
        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test.each([
        'hyphens-are-allowed',
        'underscores_are_allowed',
        'numb3rsar3all0w3d',
    ])('%s should be a valid emoji name', async (emojiName) => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, emojiName);

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).toHaveBeenCalled();
        expect(screen.queryByText('A name is required for the emoji')).not.toBeInTheDocument();
        expect(screen.queryByText(/An emoji's name can only contain/)).not.toBeInTheDocument();
    });

    test.each([
        '$ymbolsnotallowed',
        'symbolsnot@llowed',
        'symbolsnot&llowed',
        'symbolsnota|lowed',
        'symbolsnota()owed',
        'symbolsnot^llowed',
        'symbols notallowed',
        'symbols"notallowed',
        "symbols'notallowed",
        'symbols.not.allowed',
    ])("'%s' should not be a valid emoji name", async (emojiName) => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, emojiName);

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
        expect(screen.getByText("An emoji's name can only contain lowercase letters, numbers, and the symbols '-', '+' and '_'.")).toBeInTheDocument();
    });

    test.each([
        ['UPPERCASE', 'uppercase'],
        [' trimmed ', 'trimmed'],
        [':colonstrimmed:', 'colonstrimmed'],
    ])("emoji name '%s' should be corrected as '%s'", async (emojiName, expectedName) => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, emojiName);

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).toHaveBeenCalledWith({creator_id: baseProps.user.id, name: expectedName}, file);
    });

    test('should show an error when emoji name is taken by a system emoji', async () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'smiley');

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
        expect(screen.getByText('This name is already in use by a system emoji. Please choose another name.')).toBeInTheDocument();
    });

    test('should show error when emoji name is taken by an existing custom emoji', async () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'mycustomemoji');

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
        expect(screen.getByText('This name is already in use by a custom emoji. Please choose another name.')).toBeInTheDocument();
    });

    test('should show error when image is too large', async () => {
        const {container} = renderWithContext(<AddEmoji {...baseProps}/>);

        // Create a mock file with size > 1MB
        const largeFile = new File(['x'], 'large.png', {type: 'image/png'});
        Object.defineProperty(largeFile, 'size', {value: (1024 * 1024) + 1});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, largeFile);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'newcustomemoji');

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
        expect(screen.getByText('Unable to create emoji. Image must be less than 512 KiB in size.')).toBeInTheDocument();
    });

    test('should show generic error when action response cannot be parsed', async () => {
        const props: AddEmojiProps = {
            ...baseProps,
            actions: {
                createCustomEmoji: jest.fn().mockImplementation(async (): Promise<unknown> => ({})),
            },
        };

        const {container} = renderWithContext(<AddEmoji {...props}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'newemoji');

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(screen.getByText('Something went wrong when adding the custom emoji.')).toBeInTheDocument();
        });

        expect(props.actions.createCustomEmoji).toHaveBeenCalled();
    });

    test('should show response error message when action response is error', async () => {
        const serverError = 'The server does not like the emoji.';
        const props: AddEmojiProps = {
            ...baseProps,
            actions: {
                createCustomEmoji: jest.fn().mockImplementation(async (): Promise<unknown> => ({error: {message: serverError}})),
            },
        };

        const {container} = renderWithContext(<AddEmoji {...props}/>);

        const file = new File([image], 'emoji.png', {type: 'image/png'});
        setupFileReaderMock(image);

        const fileInput = container.querySelector('#select-emoji') as HTMLInputElement;
        await userEvent.upload(fileInput, file);

        const nameInput = screen.getByRole('textbox');
        await userEvent.type(nameInput, 'newemoji');

        const saveButton = screen.getByTestId('save-button');
        await userEvent.click(saveButton);

        await waitFor(() => {
            expect(screen.getByText(serverError)).toBeInTheDocument();
        });

        expect(props.actions.createCustomEmoji).toHaveBeenCalled();
    });
});
