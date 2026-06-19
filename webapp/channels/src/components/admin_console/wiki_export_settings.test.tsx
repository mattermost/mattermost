// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {Client4} from 'mattermost-redux/client';

import {fireEvent, renderWithContext, screen, waitFor} from 'tests/react_testing_utils';

import WikiExportSettings from './wiki_export_settings';

jest.mock('mattermost-redux/client');

jest.mock('./jobs', () => {
    return function MockJobsTable(props: {disabled?: boolean; jobType: string}) {
        return (
            <div
                data-testid='jobs-table'
                data-job-type={props.jobType}
                data-disabled={props.disabled}
            />
        );
    };
});

describe('components/admin_console/WikiExportSettings', () => {
    beforeEach(() => {
        (Client4.listImports as jest.Mock).mockResolvedValue([]);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('renders export and import panels', async () => {
        renderWithContext(<WikiExportSettings/>);

        expect(screen.getByText('Wiki Export')).toBeInTheDocument();
        expect(screen.getByText('Wiki Import')).toBeInTheDocument();
    });

    it('renders include attachments and comments checkboxes checked by default', async () => {
        renderWithContext(<WikiExportSettings/>);

        expect(screen.getByLabelText(/include attachments/i)).toBeChecked();
        expect(screen.getByLabelText(/include comments/i)).toBeChecked();
    });

    it('toggles include attachments checkbox', async () => {
        renderWithContext(<WikiExportSettings/>);

        const checkbox = screen.getByLabelText(/include attachments/i);
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it('toggles include comments checkbox', async () => {
        renderWithContext(<WikiExportSettings/>);

        const checkbox = screen.getByLabelText(/include comments/i);
        expect(checkbox).toBeChecked();
        fireEvent.click(checkbox);
        expect(checkbox).not.toBeChecked();
    });

    it('disables checkboxes when isDisabled is true', async () => {
        renderWithContext(<WikiExportSettings isDisabled={true}/>);

        expect(screen.getByLabelText(/include attachments/i)).toBeDisabled();
        expect(screen.getByLabelText(/include comments/i)).toBeDisabled();
    });

    it('shows loading state initially while fetching imports', () => {
        // Never resolves during this test
        (Client4.listImports as jest.Mock).mockReturnValue(new Promise(() => {}));
        renderWithContext(<WikiExportSettings/>);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('shows no files message when no imports are available', async () => {
        (Client4.listImports as jest.Mock).mockResolvedValue([]);
        renderWithContext(<WikiExportSettings/>);

        await waitFor(() => {
            expect(screen.getByText(/no import files available/i)).toBeInTheDocument();
        });
    });

    it('filters non-wiki files from imports list', async () => {
        (Client4.listImports as jest.Mock).mockResolvedValue([
            'export.jsonl',
            'backup.zip',
            'other.csv',
        ]);
        renderWithContext(<WikiExportSettings/>);

        await waitFor(() => {
            expect(screen.getByText('export.jsonl')).toBeInTheDocument();
            expect(screen.getByText('backup.zip')).toBeInTheDocument();
            expect(screen.queryByText('other.csv')).not.toBeInTheDocument();
        });
    });

    it('shows upload error for invalid file types', async () => {
        (Client4.listImports as jest.Mock).mockResolvedValue([]);
        renderWithContext(<WikiExportSettings/>);

        await waitFor(() => screen.getByText(/no import files available/i));

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['content'], 'data.csv', {type: 'text/csv'});

        fireEvent.change(input, {target: {files: [file]}});

        expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
    });

    it('uploads a valid file and refreshes imports list', async () => {
        (Client4.listImports as jest.Mock).
            mockResolvedValueOnce([]).
            mockResolvedValueOnce(['abc123_pages.jsonl']);

        (Client4.createUploadSession as jest.Mock).mockResolvedValue({id: 'abc123'});
        (Client4.uploadData as jest.Mock).mockResolvedValue({});

        renderWithContext(<WikiExportSettings/>);

        await waitFor(() => screen.getByText(/no import files available/i));

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['{}'], 'pages.jsonl', {type: 'application/json'});

        fireEvent.change(input, {target: {files: [file]}});

        await waitFor(() => {
            expect(Client4.createUploadSession).toHaveBeenCalledWith({
                type: 'import',
                filename: 'pages.jsonl',
                file_size: file.size,
            });
            expect(Client4.uploadData).toHaveBeenCalledWith('abc123', file);
        });

        await waitFor(() => {
            expect(screen.getByText('abc123_pages.jsonl')).toBeInTheDocument();
        });
    });

    it('shows error message when upload fails', async () => {
        (Client4.listImports as jest.Mock).mockResolvedValue([]);
        (Client4.createUploadSession as jest.Mock).mockRejectedValue(new Error('Network error'));

        renderWithContext(<WikiExportSettings/>);

        await waitFor(() => screen.getByText(/no import files available/i));

        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = new File(['{}'], 'pages.jsonl', {type: 'application/json'});

        fireEvent.change(input, {target: {files: [file]}});

        await waitFor(() => {
            expect(screen.getByText('Network error')).toBeInTheDocument();
        });
    });
});
