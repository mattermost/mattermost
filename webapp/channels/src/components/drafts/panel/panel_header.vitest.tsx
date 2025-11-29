// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, waitFor} from 'tests/vitest_react_testing_utils';

import PanelHeader from './panel_header';

describe('components/drafts/panel/panel_header', () => {
    const baseProps: React.ComponentProps<typeof PanelHeader> = {
        kind: 'draft' as const,
        actions: <div>{'actions'}</div>,
        timestamp: 12345,
        remote: false,
        title: <div>{'title'}</div>,
        error: undefined,
    };

    it('should match snapshot', async () => {
        const {container} = renderWithContext(
            <PanelHeader
                {...baseProps}
            />,
        );

        await waitFor(() => {
            expect(container.querySelector('.PanelHeader')).toBeInTheDocument();
        });

        // No sync icon should be present when remote is false
        expect(container.querySelector('.PanelHeader__sync-icon')).not.toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it('should show sync icon when draft is from server', async () => {
        const props = {
            ...baseProps,
            remote: true,
        };

        const {container} = renderWithContext(
            <PanelHeader
                {...props}
            />,
        );

        await waitFor(() => {
            // Sync icon should be present when remote is true
            expect(container.querySelector('.PanelHeader__sync-icon')).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });
});
