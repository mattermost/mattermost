// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {captureStillFrame} from '@mattermost/shared/utils/capture_still_frame';

import {act, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import PostEmoji from './post_emoji';

jest.mock('@mattermost/shared/utils/capture_still_frame', () => ({
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

describe('PostEmoji', () => {
    const baseProps = {
        children: ':emoji:',
        imageUrl: '/api/v4/emoji/1234/image',
        name: 'emoji',
    };

    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(document, 'visibilityState', {value: 'visible', configurable: true});
    });

    test('should render image when imageUrl is provided', () => {
        renderWithContext(<PostEmoji {...baseProps}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).toBeInTheDocument();
        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).toHaveStyle(`backgroundImage: url(${baseProps.imageUrl})}`);
    });

    test('should render shortcode text within span when imageUrl is provided', () => {
        renderWithContext(<PostEmoji {...baseProps}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).toHaveTextContent(`:${baseProps.name}:`);
    });

    test('should render children as fallback when imageUrl is empty', () => {
        const props = {
            ...baseProps,
            imageUrl: '',
        };

        renderWithContext(<PostEmoji {...props}/>);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')).not.toBeInTheDocument();
        expect(screen.getByText(`:${props.name}:`)).toBeInTheDocument();
    });

    test('should freeze to a captured still frame once the window becomes inactive', async () => {
        (captureStillFrame as jest.Mock).mockResolvedValue('data:image/png;base64,frozen-frame');

        renderWithContext(<PostEmoji {...baseProps}/>);

        setWindowActive(false);

        await waitFor(() => {
            expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')?.style.backgroundImage).
                toContain('data:image/png;base64,frozen-frame');
        });
        expect(captureStillFrame).toHaveBeenCalledWith(baseProps.imageUrl);
    });

    test('should restore the live image once the window becomes active again', async () => {
        (captureStillFrame as jest.Mock).mockResolvedValue('data:image/png;base64,frozen-frame');

        renderWithContext(<PostEmoji {...baseProps}/>);

        setWindowActive(false);
        await waitFor(() => {
            expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')?.style.backgroundImage).
                toContain('data:image/png;base64,frozen-frame');
        });

        setWindowActive(true);

        expect(screen.queryByTestId('postEmoji.:' + baseProps.name + ':')?.style.backgroundImage).
            toContain(baseProps.imageUrl);
    });
});
