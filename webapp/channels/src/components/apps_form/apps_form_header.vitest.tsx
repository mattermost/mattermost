// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {describe, test, expect} from 'vitest';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import AppsFormHeader from './apps_form_header';

describe('components/apps_form/AppsFormHeader', () => {
    test('should render message with supported values', () => {
        const props = {
            id: 'testsupported',
            value: '**bold** *italic* [link](https://mattermost.com/) <br/> [link target blank](!https://mattermost.com/)',
        };
        const {container} = renderWithContext(<AppsFormHeader {...props}/>);
        expect(container).toMatchSnapshot();
    });

    test('should not fail on empty value', () => {
        const props = {
            id: 'testblankvalue',
            value: '',
        };
        const {container} = renderWithContext(<AppsFormHeader {...props}/>);
        expect(container).toMatchSnapshot();
    });
});
