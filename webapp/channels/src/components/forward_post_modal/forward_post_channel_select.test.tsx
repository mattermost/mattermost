// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {compassIconForName} from 'components/channel_type_icon';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import {FormattedOption, makeSelectedChannelOption} from './forward_post_channel_select';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn().mockReturnValue(null),
}));

jest.mock('@mattermost/compass-icons/components', () => ({
    ChevronDownIcon: () => <svg data-testid='chevron-down-icon'/>,
    GlobeIcon: () => <svg data-testid='globe-icon'/>,
    LockOutlineIcon: () => <svg data-testid='lock-outline-icon'/>,
    MessageTextOutlineIcon: () => <svg data-testid='message-text-outline-icon'/>,
}));

jest.mock('utils/channel_utils', () => ({
    getArchiveIconComponent: jest.fn(() => () => <svg data-testid='archive-icon'/>),
}));

jest.mock('components/custom_status/custom_status_emoji', () => () => <span data-testid='custom-status-emoji'/>);
jest.mock('components/profile_picture', () => () => (
    <img
        data-testid='profile-picture'
        alt='profile'
    />
));
jest.mock('components/shared_channel_indicator', () => () => <span data-testid='shared-channel-indicator'/>);
jest.mock('components/suggestion/suggestion_results', () => ({flattenItems: jest.fn(() => [])}));
jest.mock('components/suggestion/switch_channel_provider', () => jest.fn());
jest.mock('components/widgets/tag/bot_tag', () => () => <span data-testid='bot-tag'/>);
jest.mock('components/widgets/tag/guest_tag', () => () => <span data-testid='guest-tag'/>);

// Minimal Redux state to satisfy selectors used in FormattedOption
function makeState(overrides: any[] = []) {
    const user = TestHelper.getUserMock({id: 'user-1'});
    return {
        entities: {
            users: {
                currentUserId: 'user-1',
                profiles: {[user.id]: user},
                statuses: {},
            },
            channels: {channels: {}, myMembers: {}},
            teams: {teams: {}, myMembers: {}},
            general: {config: {}},
            preferences: {myPreferences: {}},
        },
        plugins: {components: {ChannelIconOverride: overrides}},
    } as any;
}

describe('forward_post_channel_select/FormattedOption', () => {
    const mockedCompassIconForName = jest.mocked(compassIconForName);

    afterEach(() => {
        mockedCompassIconForName.mockReset();
    });

    it('renders override SVG icon with correct iconProps when plugin matches for open channel', () => {
        const StubIcon = ({size, color}: {size?: number; color?: string}) => (
            <span
                data-testid='stub-override-icon'
                data-size={size}
                data-color={color}
            />
        );
        mockedCompassIconForName.mockReturnValue(StubIcon as any);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'O', delete_at: 0});
        const option = makeSelectedChannelOption(channel);

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = screen.getByTestId('stub-override-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('data-size', '16');
        expect(icon).toHaveAttribute('data-color', 'rgba(var(--center-channel-color-rgb), 0.75)');

        // Default globe icon is absent when override wins
        expect(screen.queryByTestId('globe-icon')).not.toBeInTheDocument();
        expect(screen.queryByTestId('lock-outline-icon')).not.toBeInTheDocument();
        expect(screen.queryByTestId('archive-icon')).not.toBeInTheDocument();
    });

    it('renders fallback SVG globe icon for open channel when matcher returns false', () => {
        mockedCompassIconForName.mockReturnValue(null);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'O', delete_at: 0});
        const option = makeSelectedChannelOption(channel);

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
        );

        expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
        expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
    });

    it('renders override SVG icon with correct iconProps for archived open channel when plugin matches', () => {
        const StubIcon = ({size, color}: {size?: number; color?: string}) => (
            <span
                data-testid='stub-override-icon'
                data-size={size}
                data-color={color}
            />
        );
        mockedCompassIconForName.mockReturnValue(StubIcon as any);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'O', delete_at: 1234});
        const option = makeSelectedChannelOption(channel);

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = screen.getByTestId('stub-override-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('data-size', '16');
        expect(icon).toHaveAttribute('data-color', 'rgba(var(--center-channel-color-rgb), 0.75)');

        // Default archive icon is absent when override wins
        expect(screen.queryByTestId('archive-icon')).not.toBeInTheDocument();
    });

    it('renders fallback SVG archive icon for archived open channel when matcher returns false', () => {
        mockedCompassIconForName.mockReturnValue(null);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'O', delete_at: 1234});
        const option = makeSelectedChannelOption(channel);

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
        );

        expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
        expect(screen.getByTestId('archive-icon')).toBeInTheDocument();
    });

    it('renders override SVG icon with correct iconProps when plugin matches for private channel', () => {
        const StubIcon = ({size, color}: {size?: number; color?: string}) => (
            <span
                data-testid='stub-override-icon'
                data-size={size}
                data-color={color}
            />
        );
        mockedCompassIconForName.mockReturnValue(StubIcon as any);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'P', delete_at: 0});
        const option = makeSelectedChannelOption(channel);

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
        );

        const icon = screen.getByTestId('stub-override-icon');
        expect(icon).toBeInTheDocument();
        expect(icon).toHaveAttribute('data-size', '16');
        expect(icon).toHaveAttribute('data-color', 'rgba(var(--center-channel-color-rgb), 0.75)');

        // Default lock icon is absent when override wins
        expect(screen.queryByTestId('lock-outline-icon')).not.toBeInTheDocument();
        expect(screen.queryByTestId('globe-icon')).not.toBeInTheDocument();
    });

    it('renders fallback SVG lock icon for private channel when matcher returns false', () => {
        mockedCompassIconForName.mockReturnValue(null);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'P', delete_at: 0});
        const option = makeSelectedChannelOption(channel);

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => false, iconName: 'shield-outline'}]),
        );

        expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
        expect(screen.getByTestId('lock-outline-icon')).toBeInTheDocument();
    });

    it('does not apply override to GM channel', () => {
        const StubIcon = ({size, color}: {size?: number; color?: string}) => (
            <span
                data-testid='stub-override-icon'
                data-size={size}
                data-color={color}
            />
        );
        mockedCompassIconForName.mockReturnValue(StubIcon as any);

        const channel = TestHelper.getChannelMock({id: 'ch-1', type: 'G', delete_at: 0});
        const option = makeSelectedChannelOption(channel);

        const {container} = renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            makeState([{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]),
        );

        expect(container.querySelector('.status--group')).toBeInTheDocument();
        expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
    });

    it('does not apply override to DM channel', () => {
        const StubIcon = ({size, color}: {size?: number; color?: string}) => (
            <span
                data-testid='stub-override-icon'
                data-size={size}
                data-color={color}
            />
        );
        mockedCompassIconForName.mockReturnValue(StubIcon as any);

        const dmUser = TestHelper.getUserMock({id: 'dm-user-1'});
        const channel = {
            ...TestHelper.getChannelMock({id: 'ch-1', type: 'D', delete_at: 0}),
            userId: dmUser.id,
        } as any;
        const option = makeSelectedChannelOption(channel);

        const dmState = {
            entities: {
                users: {
                    currentUserId: 'user-1',
                    profiles: {
                        'user-1': TestHelper.getUserMock({id: 'user-1'}),
                        [dmUser.id]: dmUser,
                    },
                    statuses: {},
                },
                channels: {channels: {}, myMembers: {}},
                teams: {teams: {}, myMembers: {}},
                general: {config: {}},
                preferences: {myPreferences: {}},
            },
            plugins: {components: {ChannelIconOverride: [{id: '1', pluginId: 'p', matcher: () => true, iconName: 'shield-outline'}]}},
        } as any;

        renderWithContext(
            <FormattedOption
                {...option}
                className='option'
            />,
            dmState,
        );

        expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
        expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();
    });
});
