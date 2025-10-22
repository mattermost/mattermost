// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import {TestFooBar} from './TestFooBar';

describe('TestFooBar', () => {
    test('renders with correct text', () => {
        render(<TestFooBar/>);

        expect(screen.getByText('Foo bar baz')).toBeInTheDocument();
    });
});

