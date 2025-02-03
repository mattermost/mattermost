// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import LoadingSpinner from './loading_spinner';

jest.unmock('react-intl');

describe('components/widgets/loadingLoadingSpinner', () => {
    test('showing spinner with text', () => {
        renderWithContext(
            <LoadingSpinner
                text='test text'
            />,
        );

        expect(screen.getByText('test text')).toBeVisible();
    });

    test('showing spinner with translated text using a FormattedMessage', () => {
        const messageId = 'formattedText';
        renderWithContext(
            <LoadingSpinner
                text={
                    <FormattedMessage id={messageId}/>
                }
            />,
            {},
            {
                intlMessages: {
                    [messageId]: 'formatted message text',
                },
            },
        );

        expect(screen.getByText('formatted message text')).toBeVisible();
    });

    test('showing spinner with translated text using a MessageDescriptor', () => {
        renderWithContext(
            <LoadingSpinner
                text={{id: 'messageDescriptor'}}
            />,
            {},
            {
                intlMessages: {
                    messageDescriptor: 'message descriptor text',
                },
            },
        );

        expect(screen.getByText('message descriptor text')).toBeVisible();
    });

    test('showing spinner without text', () => {
        renderWithContext(
            <LoadingSpinner/>,
        );

        expect(screen.getByTestId('loadingSpinner')).toBeVisible();
    });
});
