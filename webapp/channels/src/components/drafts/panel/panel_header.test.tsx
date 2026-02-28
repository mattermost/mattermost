// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PanelHeader from './panel_header';

jest.mock('components/with_tooltip', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => (
        <div data-testid='with-tooltip'>{children}</div>
    ),
}));

describe('components/drafts/panel/panel_header', () => {
    const baseProps: React.ComponentProps<typeof PanelHeader> = {
        kind: 'draft' as const,
        actions: <div>{'actions'}</div>,
        timestamp: 12345,
        remote: false,
        title: <div>{'title'}</div>,
        error: undefined,
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <PanelHeader
                {...baseProps}
            />,
        );

        expect(screen.queryByTestId('with-tooltip')).not.toBeInTheDocument();
        expect(screen.getByText('actions').closest('.PanelHeader__actions')).not.toHaveClass('show');
        expect(container).toMatchSnapshot();
    });

    it('should show sync icon when draft is from server', () => {
        const props = {
            ...baseProps,
            remote: true,
        };

        const {container} = renderWithContext(
            <PanelHeader
                {...props}
            />,
        );

        expect(screen.getByTestId('with-tooltip')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
