// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

// Unmock react-intl so we can use our custom IntlProvider with test messages
vi.unmock('react-intl');

import {renderWithIntl} from 'tests/vitest_react_testing_utils';

import FormattedMarkdownMessage from './formatted_markdown_message';

const testMessages = {
    'test.foo': '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
    'test.bar': '<b>hello</b> <script>var malicious = true;</script> world!',
    'test.vals': '*Hi* {petName}!',
};

describe('components/FormattedMarkdownMessage', () => {
    test('should render message', () => {
        const props = {
            id: 'test.foo',
            defaultMessage: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        };
        const {container} = renderWithIntl(<FormattedMarkdownMessage {...props}/>, {messages: testMessages});
        expect(container).toMatchSnapshot();
    });

    test('should backup to default', () => {
        const props = {
            id: 'xxx',
            defaultMessage: 'testing default message',
        };
        const {container} = renderWithIntl(<FormattedMarkdownMessage {...props}/>, {messages: testMessages});
        expect(container).toMatchSnapshot();
    });

    test('should escape non-BR', () => {
        const props = {
            id: 'test.bar',
            defaultMessage: '',
            values: {
                b: (...content: string[]) => `<b>${content}</b>`,
                script: (...content: string[]) => `<script>${content}</script>`,
            },
        };
        const {container} = renderWithIntl(<FormattedMarkdownMessage {...props}/>, {messages: testMessages});
        expect(container).toMatchSnapshot();
    });

    test('values should work', () => {
        const props = {
            id: 'test.vals',
            defaultMessage: '*Hi* {petName}!',
            values: {
                petName: 'sweetie',
            },
        };
        const {container} = renderWithIntl(<FormattedMarkdownMessage {...props}/>, {messages: testMessages});
        expect(container).toMatchSnapshot();
    });

    test('should allow to disable links', () => {
        const props = {
            id: 'test.vals',
            defaultMessage: '*Hi* {petName}!',
            values: {
                petName: 'http://www.mattermost.com',
            },
            disableLinks: true,
        };
        const {container} = renderWithIntl(<FormattedMarkdownMessage {...props}/>, {messages: testMessages});
        expect(container).toMatchSnapshot();
    });
});
