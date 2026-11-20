// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import HealthDashboard from './index';

const NOW = Date.now();

function viewedBy(roles: string) {
    return {
        entities: {
            users: {
                currentUserId: 'admin1',
                profiles: {
                    admin1: TestHelper.getUserMock({id: 'admin1', roles}),
                },
            },
            roles: {
                roles: {
                    system_admin: TestHelper.getRoleMock({name: 'system_admin', permissions: ['manage_system']}),
                },
            },
        },
    };
}

const systemAdmin = viewedBy('system_user system_admin');
const systemUser = viewedBy('system_user');

async function renderDashboard(state: ReturnType<typeof viewedBy>) {
    renderWithContext(<HealthDashboard/>, state);
    await screen.findByText(/^Last evaluated/);
}

async function openMenu() {
    await userEvent.click(screen.getByTestId('healthDashboardExportButton'));
}

describe('components/admin_console/health_dashboard/export_menu', () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    beforeEach(() => {
        jest.spyOn(Client4, 'getHealthFindings').mockResolvedValue({evaluated_at: NOW, findings: []});
        jest.spyOn(Client4, 'getJobsByType').mockResolvedValue([]);
        URL.createObjectURL = jest.fn(() => 'blob:export');
        URL.revokeObjectURL = jest.fn();
    });

    afterEach(() => {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        document.querySelectorAll('iframe').forEach((frame) => frame.remove());
        jest.restoreAllMocks();
    });

    test('is hidden from users without manage_system', async () => {
        await renderDashboard(systemUser);

        expect(screen.queryByTestId('healthDashboardExportButton')).not.toBeInTheDocument();
    });

    test('lists the three export options', async () => {
        await renderDashboard(systemAdmin);
        await openMenu();

        expect(screen.getByRole('menuitem', {name: 'Download HTML'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Download Markdown'})).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Print / Save as PDF'})).toBeInTheDocument();
    });

    test.each([
        ['Download HTML', 'html', 'site-health-site-2026-11-19.html'],
        ['Download Markdown', 'md', 'site-health-site-2026-11-19.md'],
    ])('%s downloads the export under the server file name', async (item, format, filename) => {
        const exportHealthFindings = jest.spyOn(Client4, 'exportHealthFindings').mockResolvedValue({content: 'report', filename});
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await renderDashboard(systemAdmin);
        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: item}));

        await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
        expect(click.mock.contexts[0]).toMatchObject({download: filename, href: 'blob:export'});
        expect(exportHealthFindings).toHaveBeenCalledWith(format);
        expect(document.querySelector('iframe')).toBeNull();
    });

    test('Print / Save as PDF loads the HTML export into a sandboxed hidden iframe', async () => {
        const exportHealthFindings = jest.spyOn(Client4, 'exportHealthFindings').mockResolvedValue({content: '<h1>Report</h1>', filename: 'site-health.html'});
        const click = jest.spyOn(HTMLAnchorElement.prototype, 'click');

        await renderDashboard(systemAdmin);
        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Print / Save as PDF'}));

        await waitFor(() => expect(document.querySelector('iframe')).not.toBeNull());
        const frame = document.querySelector('iframe')!;
        expect(exportHealthFindings).toHaveBeenCalledWith('html');
        expect(frame.getAttribute('sandbox')).toBe('allow-modals allow-same-origin');
        expect(frame.srcdoc).toBe('<h1>Report</h1>');
        expect(click).not.toHaveBeenCalled();
    });

    test('shows a loading state while the export is fetched', async () => {
        let resolve: (value: {content: string; filename: string}) => void = () => {};
        jest.spyOn(Client4, 'exportHealthFindings').mockReturnValue(new Promise((r) => {
            resolve = r;
        }));
        jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        await renderDashboard(systemAdmin);
        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Download HTML'}));

        const button = screen.getByTestId('healthDashboardExportButton');
        await waitFor(() => expect(button).toBeDisabled());
        expect(button).toHaveAccessibleName('Exporting…');

        resolve({content: 'report', filename: 'site-health.html'});

        await waitFor(() => expect(button).toBeEnabled());
        expect(button).toHaveAccessibleName('Export');
    });

    test('shows an error when the export fails, and clears it on the next attempt', async () => {
        const exportHealthFindings = jest.spyOn(Client4, 'exportHealthFindings').mockRejectedValueOnce(new Error('boom'));

        await renderDashboard(systemAdmin);
        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Download HTML'}));

        expect(await screen.findByText('The health findings could not be exported. Try again.')).toBeInTheDocument();
        expect(screen.getByTestId('healthDashboardExportButton')).toBeEnabled();

        exportHealthFindings.mockResolvedValueOnce({content: 'report', filename: 'site-health.md'});
        jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Download Markdown'}));

        await waitFor(() => expect(screen.queryByText('The health findings could not be exported. Try again.')).not.toBeInTheDocument());
    });
});
