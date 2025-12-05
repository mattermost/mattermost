// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent, cleanup, act} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TeamMembersModal from './team_members_modal';

describe('components/TeamMembersModal', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(async () => {
        await act(async () => {
            vi.runAllTimers();
        });
        vi.useRealTimers();
        cleanup();
    });

    const baseProps = {
        currentTeam: TestHelper.getTeamMock({
            id: 'id',
            display_name: 'display name',
        }),
        onExited: vi.fn(),
        onLoad: vi.fn(),
        actions: {
            openModal: vi.fn(),
        },
    };

    test('should match snapshot', async () => {
        let baseElement: HTMLElement;
        await act(async () => {
            const result = renderWithContext(
                <TeamMembersModal
                    {...baseProps}
                />,
            );
            baseElement = result.baseElement;
            vi.runAllTimers();
        });

        // Modal renders to portal, so use baseElement to capture full DOM
        expect(baseElement!).toMatchSnapshot();
    });

    test('should call onHide on Modal\'s onExited', async () => {
        const onExited = vi.fn();
        await act(async () => {
            renderWithContext(
                <TeamMembersModal
                    {...baseProps}
                    onExited={onExited}
                />,
            );
            vi.runAllTimers();
        });

        const closeButton = screen.getByLabelText('Close');
        fireEvent.click(closeButton);

        await act(async () => {
            vi.runAllTimers();
        });

        expect(onExited).toHaveBeenCalledTimes(1);
    });
});
