// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Client4} from 'mattermost-redux/client';

import RichMentionEditor from './rich_mention_editor';

// Client4のモック
jest.mock('mattermost-redux/client', () => ({
    Client4: {
        autocompleteUsers: jest.fn(),
    },
}));

const mockClient4 = Client4 as jest.Mocked<typeof Client4>;

describe('RichMentionEditor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockClient4.autocompleteUsers.mockResolvedValue({
            users: [
                {
                    id: 'user1',
                    username: 'john.doe',
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john.doe@example.com',
                    nickname: '',
                    position: '',
                    roles: '',
                    locale: 'en',
                    timezone: {useAutomaticTimezone: true, automaticTimezone: '', manualTimezone: ''},
                    create_at: 0,
                    update_at: 0,
                    delete_at: 0,
                    password: '',
                    auth_data: '',
                    auth_service: '',
                    email_verified: true,
                    notify_props: {},
                    props: {},
                    last_password_update: 0,
                    last_picture_update: 0,
                    failed_attempts: 0,
                    mfa_active: false,
                    terms_of_service_id: '',
                    terms_of_service_create_at: 0,
                    is_bot: false,
                    bot_description: '',
                    bot_last_icon_update: 0,
                    remote_id: '',
                } as any,
                {
                    id: 'user2',
                    username: 'jane.smith',
                    first_name: 'Jane',
                    last_name: 'Smith',
                    email: 'jane.smith@example.com',
                    nickname: '',
                    position: '',
                    roles: '',
                    locale: 'en',
                    timezone: {useAutomaticTimezone: true, automaticTimezone: '', manualTimezone: ''},
                    create_at: 0,
                    update_at: 0,
                    delete_at: 0,
                    password: '',
                    auth_data: '',
                    auth_service: '',
                    email_verified: true,
                    notify_props: {},
                    props: {},
                    last_password_update: 0,
                    last_picture_update: 0,
                    failed_attempts: 0,
                    mfa_active: false,
                    terms_of_service_id: '',
                    terms_of_service_create_at: 0,
                    is_bot: false,
                    bot_description: '',
                    bot_last_icon_update: 0,
                    remote_id: '',
                } as any,
            ],
        });
    });

    it('should render with placeholder', () => {
        render(
            <RichMentionEditor
                value=""
                placeholder="Type a message..."
            />
        );

        const editor = screen.getByRole('textbox');
        expect(editor).toBeInTheDocument();
        expect(editor).toHaveAttribute('data-placeholder', 'Type a message...');
    });

    it('should handle text input', async () => {
        const onInput = jest.fn();
        render(
            <RichMentionEditor
                value=""
                onInput={onInput}
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, 'Hello world');

        expect(onInput).toHaveBeenCalledWith('Hello world');
    });

    it('should show mention suggestions when typing @', async () => {
        render(
            <RichMentionEditor
                value=""
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, 'Hello @john');

        await waitFor(() => {
            expect(mockClient4.autocompleteUsers).toHaveBeenCalledWith('john', '', '', {limit: 10});
        });

        await waitFor(() => {
            expect(screen.getByText('john.doe')).toBeInTheDocument();
            expect(screen.getByText('John Doe')).toBeInTheDocument();
        });
    });

    it('should navigate suggestions with arrow keys', async () => {
        render(
            <RichMentionEditor
                value=""
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, '@j');

        await waitFor(() => {
            expect(screen.getByText('john.doe')).toBeInTheDocument();
        });

        // 最初の候補が選択されている
        expect(screen.getByText('john.doe').closest('.rich-mention-editor__suggestion')).toHaveClass('rich-mention-editor__suggestion--selected');

        // 下矢印で次の候補に移動
        fireEvent.keyDown(editor, {key: 'ArrowDown'});
        expect(screen.getByText('jane.smith').closest('.rich-mention-editor__suggestion')).toHaveClass('rich-mention-editor__suggestion--selected');

        // 上矢印で前の候補に戻る
        fireEvent.keyDown(editor, {key: 'ArrowUp'});
        expect(screen.getByText('john.doe').closest('.rich-mention-editor__suggestion')).toHaveClass('rich-mention-editor__suggestion--selected');
    });

    it('should insert mention on Enter key', async () => {
        const onInput = jest.fn();
        render(
            <RichMentionEditor
                value=""
                onInput={onInput}
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, '@john');

        await waitFor(() => {
            expect(screen.getByText('john.doe')).toBeInTheDocument();
        });

        fireEvent.keyDown(editor, {key: 'Enter'});

        await waitFor(() => {
            expect(onInput).toHaveBeenCalledWith('@john.doe ');
        });
    });

    it('should insert mention on Tab key', async () => {
        const onInput = jest.fn();
        render(
            <RichMentionEditor
                value=""
                onInput={onInput}
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, '@jane');

        await waitFor(() => {
            expect(screen.getByText('jane.smith')).toBeInTheDocument();
        });

        fireEvent.keyDown(editor, {key: 'Tab'});

        await waitFor(() => {
            expect(onInput).toHaveBeenCalledWith('@jane.smith ');
        });
    });

    it('should close suggestions on Escape key', async () => {
        render(
            <RichMentionEditor
                value=""
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, '@john');

        await waitFor(() => {
            expect(screen.getByText('john.doe')).toBeInTheDocument();
        });

        fireEvent.keyDown(editor, {key: 'Escape'});

        await waitFor(() => {
            expect(screen.queryByText('john.doe')).not.toBeInTheDocument();
        });
    });

    it('should insert mention on click', async () => {
        const onInput = jest.fn();
        render(
            <RichMentionEditor
                value=""
                onInput={onInput}
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, '@j');

        await waitFor(() => {
            expect(screen.getByText('jane.smith')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByText('jane.smith').closest('.rich-mention-editor__suggestion')!);

        await waitFor(() => {
            expect(onInput).toHaveBeenCalledWith('@jane.smith ');
        });
    });

    it('should handle disabled state', () => {
        render(
            <RichMentionEditor
                value=""
                disabled={true}
            />
        );

        const editor = screen.getByRole('textbox');
        expect(editor).toHaveAttribute('contenteditable', 'false');
    });

    it('should respect maxLength', async () => {
        const onInput = jest.fn();
        render(
            <RichMentionEditor
                value=""
                maxLength={5}
                onInput={onInput}
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, 'Hello world');

        // maxLengthを超える入力は無視される
        expect(onInput).toHaveBeenLastCalledWith('Hello');
    });

    it('should handle paste events', async () => {
        const onInput = jest.fn();
        render(
            <RichMentionEditor
                value=""
                onInput={onInput}
            />
        );

        const editor = screen.getByRole('textbox');
        
        // ペーストイベントをシミュレート
        const pasteEvent = new ClipboardEvent('paste', {
            clipboardData: new DataTransfer(),
        });
        pasteEvent.clipboardData!.setData('text/plain', 'Pasted text');
        
        fireEvent.paste(editor, pasteEvent);

        await waitFor(() => {
            expect(onInput).toHaveBeenCalledWith('Pasted text');
        });
    });

    it('should handle composition events', async () => {
        render(
            <RichMentionEditor
                value=""
            />
        );

        const editor = screen.getByRole('textbox');
        
        // 日本語入力開始
        fireEvent.compositionStart(editor);
        await userEvent.type(editor, 'こんにちは');
        
        // 入力確定前は処理されない
        expect(mockClient4.autocompleteUsers).not.toHaveBeenCalled();
        
        // 入力確定
        fireEvent.compositionEnd(editor);
        
        // 確定後は処理される
        await userEvent.type(editor, '@test');
        await waitFor(() => {
            expect(mockClient4.autocompleteUsers).toHaveBeenCalled();
        });
    });

    it('should call event handlers', async () => {
        const onFocus = jest.fn();
        const onBlur = jest.fn();
        const onKeyDown = jest.fn();

        render(
            <RichMentionEditor
                value=""
                onFocus={onFocus}
                onBlur={onBlur}
                onKeyDown={onKeyDown}
            />
        );

        const editor = screen.getByRole('textbox');
        
        fireEvent.focus(editor);
        expect(onFocus).toHaveBeenCalled();

        fireEvent.keyDown(editor, {key: 'a'});
        expect(onKeyDown).toHaveBeenCalled();

        fireEvent.blur(editor);
        expect(onBlur).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
        mockClient4.autocompleteUsers.mockRejectedValue(new Error('API Error'));
        
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        render(
            <RichMentionEditor
                value=""
            />
        );

        const editor = screen.getByRole('textbox');
        await userEvent.type(editor, '@test');

        await waitFor(() => {
            expect(consoleSpy).toHaveBeenCalledWith('Error searching users:', expect.any(Error));
        });

        consoleSpy.mockRestore();
    });
});