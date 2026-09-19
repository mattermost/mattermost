// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, screen, waitFor} from '@testing-library/react';
import React from 'react';

import {Emoji} from './emoji';

import {renderWithContext} from '../../testing';
import {captureStillFrame} from '../../utils/capture_still_frame';

import '@testing-library/jest-dom';

jest.mock('../../utils/capture_still_frame', () => ({
    captureStillFrame: jest.fn().mockResolvedValue(null),
}));

function setWindowActive(isActive: boolean) {
    jest.spyOn(document, 'hasFocus').mockReturnValue(isActive);
    Object.defineProperty(document, 'visibilityState', {value: isActive ? 'visible' : 'hidden', configurable: true});
    act(() => {
        window.dispatchEvent(new Event(isActive ? 'focus' : 'blur'));
        document.dispatchEvent(new Event('visibilitychange'));
    });
}

describe('Emoji', () => {
    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
    });

    test('should render nothing when no emoji name is provided', () => {
        renderWithContext(
            <Emoji emojiName=''/>,
        );

        expect(document.querySelector('.emoticon')).not.toBeInTheDocument();
    });

    test('should render the provided system emoji', () => {
        renderWithContext(
            <Emoji emojiName='smiley'/>,
        );

        expect(document.querySelector('.emoticon')).toBe(screen.getByLabelText(':smiley:'));
        expect(screen.getByLabelText(':smiley:')).toBeInTheDocument();
        expect(screen.getByLabelText(':smiley:')).toHaveStyle({
            backgroundImage: '/static/emoji/1F603.png',
        });
    });

    test('should render the provided custom emoji', () => {
        renderWithContext(
            <Emoji emojiName='custom-emoji-1'/>,
        );

        expect(document.querySelector('.emoticon')).toBe(screen.getByLabelText(':custom-emoji-1:'));
        expect(screen.getByLabelText(':custom-emoji-1:')).toBeInTheDocument();
        expect(screen.getByLabelText(':custom-emoji-1:')).toHaveStyle({
            backgroundImage: '/api/v4/emojis/custom-emoji-id-1',
        });
    });

    test('should freeze the emoji to a captured still frame once the window becomes inactive', async () => {
        (captureStillFrame as jest.Mock).mockResolvedValue('data:image/png;base64,frozen-frame');

        renderWithContext(
            <Emoji emojiName='custom-emoji-1'/>,
        );

        setWindowActive(false);

        await waitFor(() => {
            expect(screen.getByLabelText(':custom-emoji-1:').style.backgroundImage).
                toContain('data:image/png;base64,frozen-frame');
        });
        expect(captureStillFrame).toHaveBeenCalledWith('/api/v4/emojis/custom-emoji-id-1');
    });

    test('should restore the live emoji image once the window becomes active again', async () => {
        (captureStillFrame as jest.Mock).mockResolvedValue('data:image/png;base64,frozen-frame');

        renderWithContext(
            <Emoji emojiName='custom-emoji-1'/>,
        );

        setWindowActive(false);
        await waitFor(() => {
            expect(screen.getByLabelText(':custom-emoji-1:').style.backgroundImage).
                toContain('data:image/png;base64,frozen-frame');
        });

        setWindowActive(true);

        expect(screen.getByLabelText(':custom-emoji-1:').style.backgroundImage).
            toContain('/api/v4/emojis/custom-emoji-id-1');
    });

    test('should not capture the still frame more than once for repeated blur events', async () => {
        (captureStillFrame as jest.Mock).mockResolvedValue('data:image/png;base64,frozen-frame');

        renderWithContext(
            <Emoji emojiName='custom-emoji-1'/>,
        );

        setWindowActive(false);
        await waitFor(() => expect(captureStillFrame).toHaveBeenCalledTimes(1));

        setWindowActive(true);
        setWindowActive(false);

        expect(captureStillFrame).toHaveBeenCalledTimes(1);
    });

    test('should keep showing the live image if capturing the still frame fails', async () => {
        (captureStillFrame as jest.Mock).mockResolvedValue(null);

        renderWithContext(
            <Emoji emojiName='custom-emoji-1'/>,
        );

        setWindowActive(false);

        await waitFor(() => expect(captureStillFrame).toHaveBeenCalled());

        expect(screen.getByLabelText(':custom-emoji-1:').style.backgroundImage).
            toContain('/api/v4/emojis/custom-emoji-id-1');
    });
});
