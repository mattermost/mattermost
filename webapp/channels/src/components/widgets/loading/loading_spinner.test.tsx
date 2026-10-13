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

    test('renders the Compass spinner by default', () => {
        renderWithContext(<LoadingSpinner/>);

        expect(screen.getByRole('status', {name: 'Loading Icon'})).toHaveClass('spinner');
        expect(screen.queryByTitle('Loading Icon')).not.toBeInTheDocument();
    });

    test('renders the Compass spinner at the given size', () => {
        renderWithContext(<LoadingSpinner size='24'/>);

        expect(screen.getByRole('status', {name: 'Loading Icon'})).toHaveStyle({width: '24px', height: '24px'});
    });

    test('renders the inverted Compass spinner', () => {
        renderWithContext(<LoadingSpinner inverted={true}/>);

        expect(screen.getByRole('status', {name: 'Loading Icon'}).className).toMatch(/spinner--inverted/);
    });

    test('renders the Font Awesome spinner when legacy', () => {
        renderWithContext(<LoadingSpinner legacy={true}/>);

        expect(screen.getByTitle('Loading Icon')).toHaveClass('fa fa-spinner fa-fw fa-pulse spinner');
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
});
