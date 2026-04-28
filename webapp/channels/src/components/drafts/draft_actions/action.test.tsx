// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render} from 'tests/react_testing_utils';

import Action from './action';

jest.mock('components/with_tooltip', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
        <div data-testid='with-tooltip'>{children}</div>
    ),
}));

describe('components/drafts/draft_actions/action', () => {
    const baseProps = {
        icon: 'some-icon',
        id: 'some-id',
        name: 'some-name',
        onClick: jest.fn(),
        tooltipText: 'some-tooltip-text',
    };

    it('should match snapshot', () => {
        const {container} = render(
            <Action
                {...baseProps}
            />,
        );
        expect(container).toMatchSnapshot();
    });
});
