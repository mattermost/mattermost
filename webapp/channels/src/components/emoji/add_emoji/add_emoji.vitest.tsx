// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {act} from 'react-dom/test-utils';

import type {Team} from '@mattermost/types/teams';
import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, fireEvent, waitFor} from 'tests/vitest_react_testing_utils';
import EmojiMap from 'utils/emoji_map';
import {TestHelper} from 'utils/test_helper';

import AddEmoji from './add_emoji';
import type {AddEmojiProps} from './add_emoji';

// Mock FileReader to make it synchronous for testing
class MockFileReader {
    result: string | ArrayBuffer | null = 'data:image/png;base64,mockdata';
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

    readAsDataURL() {
        // Synchronously call onload
        if (this.onload) {
            this.onload.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>);
        }
    }
}

// Replace global FileReader with mock
vi.stubGlobal('FileReader', MockFileReader);

describe('components/emoji/components/AddEmoji', () => {
    const baseProps: AddEmojiProps = {
        emojiMap: new EmojiMap(new Map([['mycustomemoji', TestHelper.getCustomEmojiMock({name: 'mycustomemoji'})]])),
        team: {
            id: 'team-id',
            name: 'team-name',
        } as Team,
        user: {
            id: 'current-user-id',
        } as UserProfile,
        actions: {
            createCustomEmoji: vi.fn().mockResolvedValue({data: {name: 'testname'}}),
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    // Helper to create a mock file with specified size
    const createMockFile = (name: string, size: number = 1000) => {
        const file = new File(['test'], name, {type: 'image/png'});
        Object.defineProperty(file, 'size', {value: size, writable: false});
        return file;
    };

    // Helper to fill out the form
    const fillForm = async (name: string, file?: File) => {
        const nameInput = document.getElementById('name') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: name}});
        });

        if (file) {
            const fileInput = document.getElementById('select-emoji') as HTMLInputElement;
            await act(async () => {
                fireEvent.change(fileInput, {target: {files: [file]}});
            });
        }
    };

    test('should match snapshot', () => {
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        // Verify the form elements are rendered
        expect(screen.getByText('Custom Emoji')).toBeInTheDocument();
        expect(screen.getByText('Add')).toBeInTheDocument();
        expect(document.getElementById('name')).toBeInTheDocument();
        expect(document.getElementById('select-emoji')).toBeInTheDocument();
        expect(screen.getByTestId('save-button')).toBeInTheDocument();
    });

    test('should update emoji name and match snapshot', async () => {
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        const nameInput = document.getElementById('name') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'newemojiname'}});
        });

        expect(nameInput).toHaveValue('newemojiname');
    });

    test('should select a file and match snapshot', async () => {
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        const file = createMockFile('test.png');
        const fileInput = document.getElementById('select-emoji') as HTMLInputElement;

        await act(async () => {
            fireEvent.change(fileInput, {target: {files: [file]}});
        });

        // After file selection, the filename should be displayed
        expect(screen.getByText('test.png')).toBeInTheDocument();
    });

    test('should submit the new added emoji', async () => {
        const createCustomEmoji = vi.fn().mockResolvedValue({data: {name: 'validname'}});
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm('validname', createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(createCustomEmoji).toHaveBeenCalledWith(
                expect.objectContaining({name: 'validname'}),
                expect.any(File),
            );
        });
    });

    test('should not submit when already saving', async () => {
        const createCustomEmoji = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm('validname', createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');

        // First click
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Second click while still saving
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // Should only be called once
        expect(createCustomEmoji).toHaveBeenCalledTimes(1);
    });

    test('should show error if emoji name unset', async () => {
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        // Submit without setting name
        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/name is required/i)).toBeInTheDocument();
        });

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test('should show error if image unset', async () => {
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        await fillForm('validname'); // No file

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/image is required/i)).toBeInTheDocument();
        });

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test.each([
        'hyphens-are-allowed',
        'underscores_are_allowed',
        'numb3rsar3all0w3d',
    ])('%s should be a valid emoji name', async (emojiName) => {
        const createCustomEmoji = vi.fn().mockResolvedValue({data: {name: emojiName}});
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm(emojiName, createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(createCustomEmoji).toHaveBeenCalled();
        });
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
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        await fillForm(emojiName, createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/can only contain lowercase letters/i)).toBeInTheDocument();
        });

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test.each([
        ['UPPERCASE', 'uppercase'],
        [' trimmed ', 'trimmed'],
        [':colonstrimmed:', 'colonstrimmed'],
    ])("emoji name '%s' should be corrected as '%s'", async (inputName, expectedName) => {
        const createCustomEmoji = vi.fn().mockResolvedValue({data: {name: expectedName}});
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm(inputName, createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(createCustomEmoji).toHaveBeenCalledWith(
                expect.objectContaining({name: expectedName}),
                expect.any(File),
            );
        });
    });

    test('should show an error when emoji name is taken by a system emoji', async () => {
        // Create emoji map with system emoji
        const emojiMapWithSystem = new EmojiMap(new Map());
        vi.spyOn(emojiMapWithSystem, 'hasSystemEmoji').mockReturnValue(true);

        const props = {...baseProps, emojiMap: emojiMapWithSystem};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm('smiley', createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/already in use by a system emoji/i)).toBeInTheDocument();
        });

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test('should show error when emoji name is taken by an existing custom emoji', async () => {
        renderWithContext(
            <AddEmoji {...baseProps}/>,
        );

        // 'mycustomemoji' is already in the emojiMap
        await fillForm('mycustomemoji', createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(screen.getByText(/already in use by a custom emoji/i)).toBeInTheDocument();
        });

        expect(baseProps.actions.createCustomEmoji).not.toHaveBeenCalled();
    });

    test('should show error when image is too large', async () => {
        const createCustomEmoji = vi.fn();
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        // Create a custom mock file-like object with a large size
        // jsdom's File.size is read-only and computed from content, so we create a mock object
        const largeFileSize = (1024 * 1024) + 1; // Just over 1MB
        const mockLargeFile = {
            name: 'large.png',
            type: 'image/png',
            size: largeFileSize,
            lastModified: Date.now(),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
            text: () => Promise.resolve(''),
            slice: () => new Blob(),
            stream: () => new ReadableStream(),
        } as unknown as File;

        // First verify the name input works
        const nameInput = document.getElementById('name') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(nameInput, {target: {value: 'validname'}});
        });
        expect(nameInput).toHaveValue('validname');

        // Trigger file selection - the MockFileReader should set state
        const fileInput = document.getElementById('select-emoji') as HTMLInputElement;
        await act(async () => {
            fireEvent.change(fileInput, {target: {files: [mockLargeFile]}});
        });

        // Wait for the filename to appear (confirms file was captured via FileReader)
        await waitFor(() => {
            expect(screen.getByText('large.png')).toBeInTheDocument();
        }, {timeout: 2000});

        // Now click save - should trigger size validation
        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        // The error message shows the limit - accept either KB or KiB format
        await waitFor(() => {
            expect(screen.getByText(/Unable to create emoji. Image must be less than/i)).toBeInTheDocument();
        }, {timeout: 3000});

        expect(createCustomEmoji).not.toHaveBeenCalled();
    });

    test('should show generic error when action response cannot be parsed', async () => {
        const createCustomEmoji = vi.fn().mockResolvedValue({}); // Empty response
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm('validname', createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(createCustomEmoji).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
        });
    });

    test('should show response error message when action response is error', async () => {
        const errorMessage = 'Server rejected the emoji';
        const createCustomEmoji = vi.fn().mockResolvedValue({error: {message: errorMessage}});
        const props = {...baseProps, actions: {createCustomEmoji}};

        renderWithContext(
            <AddEmoji {...props}/>,
        );

        await fillForm('validname', createMockFile('test.png'));

        const saveButton = screen.getByTestId('save-button');
        await act(async () => {
            fireEvent.click(saveButton);
        });

        await waitFor(() => {
            expect(createCustomEmoji).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(screen.getByText(errorMessage)).toBeInTheDocument();
        });
    });
});
