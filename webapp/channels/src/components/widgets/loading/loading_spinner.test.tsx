// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import LoadingSpinner from './loading_spinner';

jest.unmock('react-intl');

describe('components/widgets/loadingLoadingSpinner', () => {
    test('showing spinner with text', async () => {
        await renderWithContext(
            <LoadingSpinner
                text='test text'
            />,
        );

        expect(screen.getByText('test text')).toBeVisible();
    });

    test('showing spinner with translated text using a FormattedMessage', async () => {
        const messageId = 'formattedText';
        await renderWithContext(
            <LoadingSpinner
                text={
                    // eslint-disable-next-line formatjs/enforce-default-message -- test uses dynamic ID
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

    test('showing spinner with translated text using a MessageDescriptor', async () => {
        await renderWithContext(
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

    test('showing spinner without text', async () => {
        await renderWithContext(
            <LoadingSpinner/>,
        );

        expect(screen.getByTestId('loadingSpinner')).toBeVisible();
    });
});
