// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import TextDismissableBar from 'components/announcement_bar/text_dismissable_bar';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/TextDismissableBar', () => {
    const baseProps = {
        allowDismissal: true,
        text: 'sample text',
        onDismissal: vi.fn(),
        extraProp: 'test',
    };

    test('should match snapshot', () => {
        const props = baseProps;
        const {container} = renderWithContext(<TextDismissableBar {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with link but without siteURL', () => {
        const props = {...baseProps, text: 'A [link](http://testurl.com/admin_console/)'};
        const {container} = renderWithContext(<TextDismissableBar {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with an internal url', () => {
        const props = {...baseProps, text: 'A [link](http://testurl.com/admin_console/) with an internal url', siteURL: 'http://testurl.com'};
        const {container} = renderWithContext(<TextDismissableBar {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with ean external url', () => {
        const props = {...baseProps, text: 'A [link](http://otherurl.com/admin_console/) with an external url', siteURL: 'http://testurl.com'};
        const {container} = renderWithContext(<TextDismissableBar {...props}/>);

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, with an internal and an external link', () => {
        const props = {...baseProps, text: 'A [link](http://testurl.com/admin_console/) with an internal url and a [link](http://other-url.com/admin_console/) with an external url', siteURL: 'http://testurl.com'};
        const {container} = renderWithContext(<TextDismissableBar {...props}/>);

        expect(container).toMatchSnapshot();
    });
});
