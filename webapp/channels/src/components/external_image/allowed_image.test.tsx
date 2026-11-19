// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import AllowedImage, {useAllowedImageURL} from './allowed_image';

function HookProbe({src}: {src?: string}) {
    const allowed = useAllowedImageURL(src);
    return <span data-testid='allowed'>{allowed ?? 'blocked'}</span>;
}

describe('AllowedImage & useAllowedImageURL', () => {
    const blockedState = {
        entities: {
            general: {
                config: {
                    BlockExternalImages: 'true',
                    SiteURL: 'https://chat.example.com',
                },
            },
        },
    };

    test('blocks external URLs when BlockExternalImages is true and keeps internal URLs', () => {
        const {rerender} = renderWithContext(
            <AllowedImage src='https://evil.example/icon.png'>
                {(allowed) => <span data-testid='render-prop'>{allowed ?? 'none'}</span>}
            </AllowedImage>,
            blockedState,
        );
        expect(screen.getByTestId('render-prop')).toHaveTextContent('none');

        rerender(
            <AllowedImage src='https://chat.example.com/static/icon.png'>
                {(allowed) => <span data-testid='render-prop'>{allowed ?? 'none'}</span>}
            </AllowedImage>,
        );
        expect(screen.getByTestId('render-prop')).toHaveTextContent('https://chat.example.com/static/icon.png');
    });

    test('useAllowedImageURL allows external URLs when BlockExternalImages is false', () => {
        renderWithContext(
            <HookProbe src='https://evil.example/icon.png'/>,
            {
                entities: {
                    general: {
                        config: {
                            BlockExternalImages: 'false',
                            SiteURL: 'https://chat.example.com',
                        },
                    },
                },
            },
        );
        expect(screen.getByTestId('allowed')).toHaveTextContent('https://evil.example/icon.png');
    });
});
