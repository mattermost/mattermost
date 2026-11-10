// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext} from 'tests/react_testing_utils';

import ChannelIcon from './channel_icon';

function makeChannel(partial: Partial<Channel> = {}): Channel {
    return {
        id: 'channel-1',
        type: 'O',
        delete_at: 0,
        ...partial,
    } as Channel;
}

function makeState(overrides: any[] = []) {
    return {plugins: {components: {ChannelIconOverride: overrides}}} as any;
}

const matchingOverride = {id: '1', pluginId: 'mbe', matcher: () => true, iconName: 'shield-outline'};
const nonMatchingOverride = {id: '1', pluginId: 'mbe', matcher: () => false, iconName: 'shield-outline'};

describe('components/ChannelIcon', () => {
    it('renders the default SVG icon with no override on a non-archived channel', () => {
        renderWithContext(
            <ChannelIcon
                channel={makeChannel({type: 'O'})}
                data-testid='channel-icon'
            />,
            makeState(),
        );
        const icon = screen.getByTestId('channel-icon');
        expect(icon).not.toHaveClass('svg-text-color');
    });

    it('renders the override SVG icon without svg-text-color on a non-archived channel', () => {
        renderWithContext(
            <ChannelIcon
                channel={makeChannel({type: 'O'})}
                data-testid='channel-icon'
            />,
            makeState([matchingOverride]),
        );
        const icon = screen.getByTestId('channel-icon');
        expect(icon).not.toHaveClass('svg-text-color');
    });

    it('injects svg-text-color when override matches an archived channel', () => {
        renderWithContext(
            <ChannelIcon
                channel={makeChannel({type: 'O', delete_at: 1234})}
                data-testid='channel-icon'
            />,
            makeState([matchingOverride]),
        );
        const icon = screen.getByTestId('channel-icon');
        expect(icon).toHaveClass('svg-text-color');
    });

    it('does not inject svg-text-color when no override matches an archived channel', () => {
        renderWithContext(
            <ChannelIcon
                channel={makeChannel({type: 'O', delete_at: 1234})}
                data-testid='channel-icon'
            />,
            makeState([nonMatchingOverride]),
        );
        const icon = screen.getByTestId('channel-icon');
        expect(icon).not.toHaveClass('svg-text-color');
    });

    it('merges external className with svg-text-color when override + archived', () => {
        renderWithContext(
            <ChannelIcon
                channel={makeChannel({type: 'O', delete_at: 1234})}
                className='extra-class'
                data-testid='channel-icon'
            />,
            makeState([matchingOverride]),
        );
        const icon = screen.getByTestId('channel-icon');
        expect(icon).toHaveClass('svg-text-color');
        expect(icon).toHaveClass('extra-class');
    });

    it('uses external className only when override + non-archived', () => {
        renderWithContext(
            <ChannelIcon
                channel={makeChannel({type: 'O'})}
                className='extra-class'
                data-testid='channel-icon'
            />,
            makeState([matchingOverride]),
        );
        const icon = screen.getByTestId('channel-icon');
        expect(icon).not.toHaveClass('svg-text-color');
        expect(icon).toHaveClass('extra-class');
    });

    it('renders an SVG element when size prop is provided', () => {
        const {container} = renderWithContext(
            <ChannelIcon
                channel={makeChannel()}
                size={20}
            />,
            makeState([matchingOverride]),
        );
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('does not inject data-testid when the prop is omitted', () => {
        // Regression: ChannelIcon previously passed data-testid={undefined} unconditionally,
        // which overrides a downstream icon component's own hardcoded data-testid via JSX spread.
        const {container} = renderWithContext(
            <ChannelIcon channel={makeChannel({type: 'O'})}/>,
            makeState(),
        );
        expect(container.querySelector('[data-testid]')).not.toBeInTheDocument();
    });
});
