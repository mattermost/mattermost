// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import WorkspaceOptimizationDashboard from './dashboard';
import {ItemStatus} from './dashboard.type';

import type {Props} from '../admin_console';

jest.mock('./dashboard.data', () => ({
    __esModule: true,
    default: jest.fn(),
}));

jest.mock('components/widgets/admin_console/admin_header', () => ({
    __esModule: true,
    default: ({children}: {children?: React.ReactNode}) => <div className='AdminHeader'>{children}</div>,
}));

const useMetricsData = require('./dashboard.data').default as jest.Mock;

describe('components/admin_console/workspace-optimization/dashboard', () => {
    const baseProps = {
        config: {},
    } as Props;

    beforeEach(() => {
        useMetricsData.mockReset();
    });

    test('should render AdminPanel sections instead of accordion cards', async () => {
        useMetricsData.mockReturnValue({
            loading: false,
            data: {
                updates: {
                    title: 'Server updates',
                    description: 'An update is available.',
                    descriptionOk: 'Your workspace is completely up to date!',
                    icon: <span>{'updates-icon'}</span>,
                    items: [{
                        id: 'version',
                        title: 'Update available',
                        description: 'Install the latest version.',
                        status: ItemStatus.WARNING,
                        scoreImpact: 20,
                        impactModifier: 0.25,
                        infoUrl: 'https://example.com',
                        infoText: 'Learn more',
                        configUrl: '/admin_console',
                        configText: 'Go to config',
                    }],
                },
                configuration: {
                    title: 'Configuration',
                    description: 'You have configuration issues to resolve',
                    descriptionOk: 'You have successfully configured SSL and Session Lengths!',
                    icon: <span>{'config-icon'}</span>,
                    items: [{
                        id: 'ssl',
                        title: 'SSL ok',
                        description: 'SSL is configured',
                        status: ItemStatus.OK,
                        scoreImpact: 10,
                        impactModifier: 1,
                    }],
                },
            },
        });

        renderWithContext(
            <WorkspaceOptimizationDashboard {...baseProps}/>,
        );

        expect(screen.getByText('Workspace Optimization')).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Server updates'})).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: 'Configuration'})).toBeInTheDocument();
        expect(screen.getByText('An update is available.')).toBeInTheDocument();
        expect(screen.getByText('You have successfully configured SSL and Session Lengths!')).toBeInTheDocument();

        expect(document.querySelector('.accordion-card')).not.toBeInTheDocument();
        expect(document.querySelectorAll('section.AdminPanel.WorkspaceOptimizationDashboard__section')).toHaveLength(2);

        const configurationPanel = document.getElementById('workspace-optimization-configuration');
        expect(configurationPanel).toHaveClass('WorkspaceOptimizationDashboard__section--header-only');
        expect(configurationPanel).toHaveClass('WorkspaceOptimizationDashboard__section--success');
        expect(configurationPanel?.querySelector('[aria-label="Expand section"]')).not.toBeInTheDocument();

        const updatesPanel = document.getElementById('workspace-optimization-updates');
        const collapse = updatesPanel?.querySelector('[class*="admin-panel__collapse"]');
        expect(collapse).toHaveAttribute('aria-hidden', 'true');

        await userEvent.click(screen.getByRole('button', {name: 'Expand section'}));
        expect(collapse).toHaveAttribute('aria-hidden', 'false');
        expect(screen.getByText('Update available')).toBeInTheDocument();
        expect(screen.getByText('Install the latest version.')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', {name: 'Collapse section'}));
        expect(collapse).toHaveAttribute('aria-hidden', 'true');

        // Whole header is clickable (former accordion behavior), not only the chevron.
        await userEvent.click(screen.getByRole('heading', {name: 'Server updates'}));
        expect(collapse).toHaveAttribute('aria-hidden', 'false');
        await userEvent.click(screen.getByText('An update is available.'));
        expect(collapse).toHaveAttribute('aria-hidden', 'true');
    });

    test('should show loading screen while metrics load', () => {
        useMetricsData.mockReturnValue({
            loading: true,
            data: undefined,
        });

        renderWithContext(
            <WorkspaceOptimizationDashboard {...baseProps}/>,
        );

        expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });
});
