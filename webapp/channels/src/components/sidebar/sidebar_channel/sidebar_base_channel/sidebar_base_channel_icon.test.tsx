// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';

import type {ChannelType} from '@mattermost/types/channels';

import SidebarBaseChannelIcon from './sidebar_base_channel_icon';

// Mock icon library functions
jest.mock('components/channel_settings_modal/icon_libraries', () => ({
    getMdiIconPath: (name: string) => (name === 'star' ? 'M12 star-path' : null),
    getLucideIconPaths: (name: string) => (name === 'heart' ? ['M12 heart-path'] : null),
    getTablerIconPaths: (name: string) => (name === 'home' ? ['M12 home-path'] : null),
    getFeatherIconSvg: (name: string) => (name === 'circle' ? '<circle cx="12" cy="12" r="10"/>' : null),
    getSimpleIconPath: (name: string) => (name === 'github' ? 'M12 github-path' : null),
    getFontAwesomeIconPath: (name: string) => (name === 'bell' ? 'M12 bell-path' : null),
    parseIconValue: (value: string) => {
        const parts = value.split(':');
        if (parts.length === 2) {
            return {format: parts[0], name: parts[1]};
        }
        return {format: '', name: ''};
    },
    getCustomSvgById: (userId: string, svgId: string) => {
        if (userId === 'user123' && svgId === 'custom1') {
            return {
                id: 'custom1',
                name: 'Custom Icon',
                svg: btoa('<svg viewBox="0 0 24 24"><path d="M12 custom"/></svg>'),
                normalizeColor: true,
            };
        }
        return null;
    },
    decodeSvgFromBase64: (base64: string) => atob(base64),
    sanitizeSvg: (svg: string) => svg,
    normalizeSvgColors: (svg: string) => svg.replace(/fill="[^"]*"/g, 'fill="currentColor"'),
    normalizeSvgViewBox: (svg: string) => svg,
}));

const mockStore = configureStore();

describe('SidebarBaseChannelIcon', () => {
    const createStore = (userId: string = 'user123') => mockStore({
        entities: {
            users: {
                currentUserId: userId,
            },
        },
    });

    const renderWithStore = (component: React.ReactElement, userId?: string) => {
        const store = createStore(userId);
        return render(
            <Provider store={store}>
                {component}
            </Provider>,
        );
    };

    describe('Default icons', () => {
        test('renders globe icon for public channel', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        test('renders lock icon for private channel', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'P' as ChannelType} />,
            );

            const icon = document.querySelector('.icon-lock-outline');
            expect(icon).toBeInTheDocument();
        });

        test('returns null for other channel types without custom icon', () => {
            const {container} = renderWithStore(
                <SidebarBaseChannelIcon channelType={'D' as ChannelType} />,
            );

            expect(container.firstChild).toBeNull();
        });
    });

    describe('MDI icons', () => {
        test('renders MDI icon correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='mdi:star' />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--mdi');
            expect(icon).toBeInTheDocument();

            const svg = icon?.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('viewBox', '0 0 24 24');

            const path = svg?.querySelector('path');
            expect(path).toHaveAttribute('d', 'M12 star-path');
        });

        test('falls back to globe for invalid MDI icon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='mdi:invalid' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Lucide icons', () => {
        test('renders Lucide icon correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='lucide:heart' />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--lucide');
            expect(icon).toBeInTheDocument();

            const svg = icon?.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('fill', 'none');
            expect(svg).toHaveAttribute('stroke', 'currentColor');
            expect(svg).toHaveAttribute('stroke-width', '2');
        });

        test('falls back to globe for invalid Lucide icon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='lucide:invalid' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Tabler icons', () => {
        test('renders Tabler icon correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='tabler:home' />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--tabler');
            expect(icon).toBeInTheDocument();

            const svg = icon?.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('stroke', 'currentColor');
        });

        test('falls back to globe for invalid Tabler icon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='tabler:invalid' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Feather icons', () => {
        test('renders Feather icon correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='feather:circle' />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--feather');
            expect(icon).toBeInTheDocument();

            const svg = icon?.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('stroke', 'currentColor');
        });

        test('falls back to globe for invalid Feather icon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='feather:invalid' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Simple (brand) icons', () => {
        test('renders Simple icon correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='simple:github' />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--simple');
            expect(icon).toBeInTheDocument();

            const svg = icon?.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('fill', 'currentColor');
        });

        test('falls back to globe for invalid Simple icon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='simple:invalid' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Font Awesome icons', () => {
        test('renders Font Awesome icon correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='fontawesome:bell' />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--fontawesome');
            expect(icon).toBeInTheDocument();

            const svg = icon?.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('viewBox', '0 0 512 512');
        });

        test('falls back to globe for invalid Font Awesome icon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='fontawesome:invalid' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Custom SVG icons (registered)', () => {
        test('renders registered custom SVG correctly', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='customsvg:custom1' />,
                'user123',
            );

            const icon = document.querySelector('.sidebar-channel-icon--custom');
            expect(icon).toBeInTheDocument();
        });

        test('falls back to globe for missing custom SVG', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='customsvg:missing' />,
                'user123',
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        test('falls back to globe when user ID is missing', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='customsvg:custom1' />,
                '', // Empty user ID
            );

            // Should fall back to default since no userId
            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Legacy base64 SVG icons', () => {
        test('renders base64 SVG correctly', () => {
            const base64Svg = btoa('<svg viewBox="0 0 24 24"><path d="M12 test"/></svg>');
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon={`svg:${base64Svg}`} />,
            );

            const icon = document.querySelector('.sidebar-channel-icon--custom');
            expect(icon).toBeInTheDocument();
        });

        test('falls back to globe for invalid base64', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='svg:not-valid-base64!!!' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Icon sizing', () => {
        test('MDI icons have correct size', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='mdi:star' />,
            );

            const svg = document.querySelector('.sidebar-channel-icon--mdi svg');
            expect(svg).toHaveAttribute('width', '18');
            expect(svg).toHaveAttribute('height', '18');
        });

        test('Lucide icons have correct size', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='lucide:heart' />,
            );

            const svg = document.querySelector('.sidebar-channel-icon--lucide svg');
            expect(svg).toHaveAttribute('width', '18');
            expect(svg).toHaveAttribute('height', '18');
        });
    });

    describe('Edge cases', () => {
        test('handles empty customIcon string', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        test('handles undefined customIcon', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        test('handles customIcon with only format', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='mdi:' />,
            );

            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });

        test('handles unknown format', () => {
            renderWithStore(
                <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon='unknown:test' />,
            );

            // Falls back to default icon
            const icon = document.querySelector('.icon-globe');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Icon classes', () => {
        test('all custom icons have sidebar-channel-icon class', () => {
            const testCases = [
                {icon: 'mdi:star', expectedClass: 'sidebar-channel-icon--mdi'},
                {icon: 'lucide:heart', expectedClass: 'sidebar-channel-icon--lucide'},
                {icon: 'tabler:home', expectedClass: 'sidebar-channel-icon--tabler'},
                {icon: 'feather:circle', expectedClass: 'sidebar-channel-icon--feather'},
                {icon: 'simple:github', expectedClass: 'sidebar-channel-icon--simple'},
                {icon: 'fontawesome:bell', expectedClass: 'sidebar-channel-icon--fontawesome'},
            ];

            testCases.forEach(({icon, expectedClass}) => {
                const {unmount} = renderWithStore(
                    <SidebarBaseChannelIcon channelType={'O' as ChannelType} customIcon={icon} />,
                );

                const iconElement = document.querySelector(`.${expectedClass}`);
                expect(iconElement).toBeInTheDocument();
                expect(iconElement).toHaveClass('sidebar-channel-icon');
                expect(iconElement).toHaveClass('icon');

                unmount();
            });
        });
    });
});
