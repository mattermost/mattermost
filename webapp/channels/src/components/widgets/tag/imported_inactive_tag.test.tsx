// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen} from '@testing-library/react';
import React from 'react';

import {withIntl} from 'tests/helpers/intl-test-helper';

import ImportedInactiveTag from './imported_inactive_tag';

describe('components/widgets/tag/ImportedInactiveTag', () => {
    test('should render with default props', () => {
        render(withIntl(<ImportedInactiveTag/>));

        const text = screen.getByText('IMPORTED - INACTIVE');
        expect(text).toBeInTheDocument();

        const tag = text.parentElement;
        expect(tag).toHaveClass('Tag', 'ImportedInactiveTag', 'Tag--xs');
    });

    test('should render with custom className', () => {
        render(withIntl(<ImportedInactiveTag className='user-popover__role'/>));

        const text = screen.getByText('IMPORTED - INACTIVE');
        const tag = text.parentElement;
        expect(tag).toHaveClass('Tag', 'ImportedInactiveTag', 'user-popover__role', 'Tag--xs');
    });

    test('should render with custom size', () => {
        render(withIntl(<ImportedInactiveTag size='sm'/>));

        const text = screen.getByText('IMPORTED - INACTIVE');
        const tag = text.parentElement;
        expect(tag).toHaveClass('Tag', 'ImportedInactiveTag', 'Tag--sm');
    });
});
