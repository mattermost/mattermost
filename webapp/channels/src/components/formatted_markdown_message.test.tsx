// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {IntlProvider} from 'react-intl';

import {render} from 'tests/react_testing_utils';

import FormattedMarkdownMessage from './formatted_markdown_message';

jest.unmock('react-intl');

describe('components/FormattedMarkdownMessage', () => {
    test('should render message', () => {
        const props = {
            id: 'test.foo',
            defaultMessage: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        };
        const {container} = render(wrapProvider(<FormattedMarkdownMessage {...props}/>));
        expect(container).toMatchSnapshot();
    });

    test('should backup to default', () => {
        const props = {
            id: 'xxx',
            defaultMessage: 'testing default message',
        };
        const {container} = render(wrapProvider(<FormattedMarkdownMessage {...props}/>));
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
        const {container} = render(wrapProvider(<FormattedMarkdownMessage {...props}/>));
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
        const {container} = render(wrapProvider(<FormattedMarkdownMessage {...props}/>));
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
        const {container} = render(wrapProvider(<FormattedMarkdownMessage {...props}/>));
        expect(container).toMatchSnapshot();
    });
});

function wrapProvider(el: JSX.Element) {
    const enTranslationData = {
        'test.foo': '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        'test.bar': '<b>hello</b> <script>var malicious = true;</script> world!',
        'test.vals': '*Hi* {petName}!',
    };
    return (
        <IntlProvider
            locale={'en'}
            messages={enTranslationData}
        >
            {el}
        </IntlProvider>
    );
}
