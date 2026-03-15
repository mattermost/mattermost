// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent, screen, waitFor} from 'tests/react_testing_utils';

import PlainLogList from './plain_log_list';

describe('components/admin_console/server_logs/PlainLogList', () => {
    const sampleLogs = [
        '2024-01-01 00:00:01.000 [INFO] Starting server caller=app/server.go:123',
        '2024-01-01 00:00:02.000 [EROR] Something went wrong caller=app/handler.go:45',
        '2024-01-01 00:00:03.000 [WARN] Deprecation notice caller=app/config.go:78',
        '2024-01-01 00:00:04.000 [DBUG] Debug output caller=app/debug.go:10',
    ];

    const defaultProps = {
        loading: false,
        logs: sampleLogs,
        page: 0,
        perPage: 100,
        nextPage: jest.fn(),
        previousPage: jest.fn(),
        goToPage: jest.fn(),
        onReload: jest.fn(),
        downloadUrl: '/api/v4/logs/download',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render log lines', () => {
        renderWithContext(<PlainLogList {...defaultProps}/>);

        expect(screen.getByText(/Starting server/)).toBeInTheDocument();
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
        expect(screen.getByText(/Deprecation notice/)).toBeInTheDocument();
        expect(screen.getByText(/Debug output/)).toBeInTheDocument();
    });

    test('should show page info', () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                page={2}
            />,
        );

        // Page is 0-indexed, displayed as page+1 = 3
        expect(screen.getByText(/Page 3/)).toBeInTheDocument();
        expect(screen.getByText(/4 lines/)).toBeInTheDocument();
    });

    test('should show loading state', () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                loading={true}
            />,
        );

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    test('should show empty state when no logs', () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                logs={[]}
            />,
        );

        expect(screen.getByText('No logs to display.')).toBeInTheDocument();
    });

    test('should call onReload when reload button is clicked', async () => {
        renderWithContext(<PlainLogList {...defaultProps}/>);

        const reloadButton = screen.getByText('Reload');
        await userEvent.click(reloadButton);

        expect(defaultProps.onReload).toHaveBeenCalledTimes(1);
    });

    test('should call nextPage when next button is clicked', async () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                perPage={4}
            />,
        );

        const nextButton = screen.getByTitle('Next page');
        await userEvent.click(nextButton);

        expect(defaultProps.nextPage).toHaveBeenCalledTimes(1);
    });

    test('should call previousPage when previous button is clicked', async () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                page={1}
            />,
        );

        const prevButton = screen.getByTitle('Previous page');
        await userEvent.click(prevButton);

        expect(defaultProps.previousPage).toHaveBeenCalledTimes(1);
    });

    test('should disable previous and first page buttons on first page', () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                page={0}
            />,
        );

        const firstPageButton = screen.getByTitle('First page');
        const prevButton = screen.getByTitle('Previous page');

        expect(firstPageButton).toBeDisabled();
        expect(prevButton).toBeDisabled();
    });

    test('should call goToPage(0) when first page button is clicked', async () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                page={3}
            />,
        );

        const firstPageButton = screen.getByTitle('First page');
        await userEvent.click(firstPageButton);

        expect(defaultProps.goToPage).toHaveBeenCalledWith(0);
    });

    test('should disable next page button when fewer logs than perPage', () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                logs={sampleLogs}
                perPage={100}
            />,
        );

        // 4 logs < 100 perPage, so hasMore is false
        const nextButton = screen.getByTitle('Next page');
        expect(nextButton).toBeDisabled();
    });

    test('should enable next page button when logs equal perPage', () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                logs={sampleLogs}
                perPage={4}
            />,
        );

        // 4 logs === 4 perPage, so hasMore is true
        const nextButton = screen.getByTitle('Next page');
        expect(nextButton).not.toBeDisabled();
    });

    test('should toggle line numbers on and off', async () => {
        renderWithContext(<PlainLogList {...defaultProps}/>);

        const content = document.querySelector('.PlainLogViewer__content');

        // Line numbers are on by default
        expect(content).toHaveClass('PlainLogViewer__content--numbered');

        const linesButton = screen.getByText('Lines');
        await userEvent.click(linesButton);

        // After clicking, line numbers should be off
        expect(content).not.toHaveClass('PlainLogViewer__content--numbered');

        await userEvent.click(linesButton);

        // After clicking again, line numbers should be back on
        expect(content).toHaveClass('PlainLogViewer__content--numbered');
    });

    test('should toggle wrap text on and off', async () => {
        renderWithContext(<PlainLogList {...defaultProps}/>);

        const content = document.querySelector('.PlainLogViewer__content');

        // Wrap is off by default
        expect(content).not.toHaveClass('PlainLogViewer__content--wrap');

        // Default state shows "Wrap" button
        const wrapButton = screen.getByText('Wrap');
        await userEvent.click(wrapButton);

        // After clicking, wrap should be on, button text changes to "No wrap"
        expect(content).toHaveClass('PlainLogViewer__content--wrap');
        expect(screen.getByText('No wrap')).toBeInTheDocument();

        await userEvent.click(screen.getByText('No wrap'));

        // After clicking again, wrap should be off
        expect(content).not.toHaveClass('PlainLogViewer__content--wrap');
        expect(screen.getByText('Wrap')).toBeInTheDocument();
    });

    test('should toggle newest first ordering', async () => {
        renderWithContext(<PlainLogList {...defaultProps}/>);

        // Default is oldest first, button says "Oldest"
        expect(screen.getByText('Oldest')).toBeInTheDocument();

        const sortButton = screen.getByText('Oldest');
        await userEvent.click(sortButton);

        // After clicking, it becomes newest first, button says "Newest"
        await waitFor(() => {
            expect(screen.getByText('Newest')).toBeInTheDocument();
        });

        // Check that log lines are in reversed order by examining DOM order
        const lines = document.querySelectorAll('.PlainLogViewer__line');
        expect(lines.length).toBe(4);

        // First displayed line should now be the last log (Debug output)
        expect(lines[0].textContent).toContain('Debug output');

        // Last displayed line should now be the first log (Starting server)
        expect(lines[3].textContent).toContain('Starting server');
    });

    test('should show go-to-page input when page number is clicked', async () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                page={2}
            />,
        );

        // Click the page number button
        const pageNumButton = screen.getByTitle('Go to page');
        await userEvent.click(pageNumButton);

        await waitFor(() => {
            expect(screen.getByText('Go to page:')).toBeInTheDocument();
        });

        // The input should be pre-filled with the current page number (1-indexed)
        const input = screen.getByRole('spinbutton');
        expect(input).toHaveValue(3);
    });

    test('should navigate to entered page when go button is clicked', async () => {
        renderWithContext(
            <PlainLogList
                {...defaultProps}
                page={0}
            />,
        );

        // Open go-to-page
        const pageNumButton = screen.getByTitle('Go to page');
        await userEvent.click(pageNumButton);

        await waitFor(() => {
            expect(screen.getByText('Go to page:')).toBeInTheDocument();
        });

        const input = screen.getByRole('spinbutton');
        await userEvent.clear(input);
        await userEvent.type(input, '5');

        const goButton = screen.getByText('Go');
        await userEvent.click(goButton);

        // goToPage is called with 0-indexed page (5-1=4)
        expect(defaultProps.goToPage).toHaveBeenCalledWith(4);
    });

    test('should render download link', () => {
        renderWithContext(<PlainLogList {...defaultProps}/>);

        const downloadLink = screen.getByText('Download');
        expect(downloadLink).toBeInTheDocument();
        expect(downloadLink.closest('a')).toHaveAttribute('href', '/api/v4/logs/download');
    });
});
