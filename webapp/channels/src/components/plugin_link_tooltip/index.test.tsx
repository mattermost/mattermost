// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {RootHtmlPortalId} from 'utils/constants';

import PluginLinkTooltip from '.';

class TestLinkTooltip extends React.PureComponent<{href: string}> {
    render() {
        if (this.props.href.includes('tooltip')) {
            return <div>{'This is a link tooltip'}</div>;
        }

        return null;
    }
}

describe('PluginLinkTooltip', () => {
    const baseState = {
        plugins: {
            components: {
                LinkTooltip: [
                    {
                        id: 'test',
                        pluginId: 'example.test',
                        component: TestLinkTooltip,
                    },
                ],
            },
        },
    };

    test('should show tooltip on hover', async () => {
        renderWithContext(
            <>
                <PluginLinkTooltip
                    nodeAttributes={{
                        href: 'https://example.com/tooltip',
                    }}
                >
                    {'This is a link'}
                </PluginLinkTooltip>
                <div id={RootHtmlPortalId}/>
            </>,
            baseState,
        );

        expect(screen.queryByText('This is a link tooltip')).not.toBeInTheDocument();

        await userEvent.hover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).toBeVisible();
        });

        await userEvent.unhover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).not.toBeInTheDocument();
        });
    });

    test('should not take focus when the tooltip appears', async () => {
        renderWithContext(
            <>
                <textarea data-testid='textarea'/>
                <PluginLinkTooltip
                    nodeAttributes={{
                        href: 'https://example.com/tooltip',
                    }}
                >
                    {'This is a link'}
                </PluginLinkTooltip>
                <div id={RootHtmlPortalId}/>
            </>,
            baseState,
        );

        screen.getByTestId('textarea').focus();

        await userEvent.hover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).toBeVisible();
        });

        expect(screen.getByTestId('textarea')).toHaveFocus();

        await userEvent.unhover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).not.toBeInTheDocument();
        });

        expect(screen.getByTestId('textarea')).toHaveFocus();
    });

    test('should not block interaction with elements outside the tooltip', async () => {
        renderWithContext(
            <>
                <textarea
                    data-testid='textarea'
                    defaultValue='some text'
                />
                <PluginLinkTooltip
                    nodeAttributes={{
                        href: 'https://example.com/tooltip',
                    }}
                >
                    {'This is a link'}
                </PluginLinkTooltip>
                <div id={RootHtmlPortalId}/>
            </>,
            baseState,
        );

        // # Hover over the link to show the tooltip
        await userEvent.hover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).toBeVisible();
        });

        // * Verify the overlay has pointer-events: none so it doesn't block clicks
        const overlay = document.querySelector('.plugin-link-tooltip-floating-overlay') as HTMLElement;
        expect(overlay).toBeInTheDocument();
        expect(overlay.style.pointerEvents || getComputedStyle(overlay).pointerEvents).toBe('none');
    });

    test('should not take focus when hovered without a tooltip', async () => {
        renderWithContext(
            <>
                <textarea data-testid='textarea'/>
                <PluginLinkTooltip
                    nodeAttributes={{
                        href: 'https://example.com',
                    }}
                >
                    {'This is a link'}
                </PluginLinkTooltip>
                <div id={RootHtmlPortalId}/>
            </>,
            baseState,
        );

        screen.getByTestId('textarea').focus();

        await userEvent.hover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).not.toBeInTheDocument();
        });

        expect(screen.getByTestId('textarea')).toHaveFocus();

        await userEvent.unhover(screen.getByText('This is a link'));
        await waitFor(() => {
            expect(screen.queryByText('This is a link tooltip')).not.toBeInTheDocument();
        });

        expect(screen.getByTestId('textarea')).toHaveFocus();
    });
});
