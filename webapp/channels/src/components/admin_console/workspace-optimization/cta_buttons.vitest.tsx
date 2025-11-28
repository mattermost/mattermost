// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import CtaButtons from 'components/admin_console/workspace-optimization/cta_buttons';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

describe('components/admin_console/workspace-optimization/cta_buttons', () => {
    const baseProps = {
        learnMoreLink: '/learn_more',
        learnMoreText: 'Learn More',
        actionLink: '/action_link',
        actionText: 'Action Text',
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<CtaButtons {...baseProps}/>);
        expect(container).toMatchSnapshot();
    });

    test('test ctaButtons list length is 2 as defined in baseProps', () => {
        renderWithContext(<CtaButtons {...baseProps}/>);
        const ctaButtons = screen.getAllByRole('button');

        expect(ctaButtons.length).toBe(2);
    });
});
