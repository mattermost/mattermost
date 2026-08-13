// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {LogLevelEnum} from '@mattermost/types/admin';

import {act, fireEvent, renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';

import LogRow from './log_row';
import type {LogObjectWithAdditionalInfo} from './types';

describe('components/admin_console/server_logs/LogRow', () => {
    const baseLog: LogObjectWithAdditionalInfo = {
        caller: 'app/server.go:123',
        job_id: 'job1',
        level: LogLevelEnum.INFO,
        msg: 'Something happened',
        timestamp: '2024-01-01 12:34:56.789 +00:00',
        worker: 'worker1',
    };

    const defaultProps = {
        log: baseLog,
        isExpanded: false,
        isFocused: false,
        onToggleExpand: jest.fn(),
        onFocus: jest.fn(),
        searchTerm: '',
        wrapText: false,
    };

    const writeText = jest.fn();

    // The wrapper carries the list item semantics; the summary inside it is the
    // disclosure control that owns the click, keyboard and aria-expanded behaviour
    const getRow = () => screen.getByRole('listitem');
    const getRowSummary = () => document.querySelector<HTMLElement>('.LogRow__main')!;

    const renderLogRow = (props: Partial<typeof defaultProps> = {}) => {
        return renderWithContext(
            <LogRow
                {...defaultProps}
                {...props}
            />,
        );
    };

    beforeEach(() => {
        writeText.mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: {writeText},
        });
    });

    describe('rendering', () => {
        test('should render the level label, short timestamp, message and caller', () => {
            renderLogRow();

            expect(screen.getByText('INF')).toBeInTheDocument();

            // Only the time portion of the timestamp is displayed
            expect(screen.getByText('12:34:56.789')).toBeInTheDocument();
            expect(screen.getByText('Something happened')).toBeInTheDocument();
            expect(screen.getByText('app/server.go:123')).toBeInTheDocument();
        });

        test('should show the full timestamp as a title attribute', () => {
            renderLogRow();

            expect(screen.getByText('12:34:56.789')).toHaveAttribute('title', baseLog.timestamp);
        });

        test('should fall back to the raw timestamp when no time can be extracted', () => {
            renderLogRow({log: {...baseLog, timestamp: 'not a timestamp'}});

            expect(screen.getByText('not a timestamp')).toBeInTheDocument();
        });

        test.each([
            [LogLevelEnum.ERROR, 'ERR'],
            [LogLevelEnum.WARN, 'WRN'],
            [LogLevelEnum.INFO, 'INF'],
            [LogLevelEnum.DEBUG, 'DBG'],
        ])('should render the %s level as %s', (level, label) => {
            renderLogRow({log: {...baseLog, level}});

            expect(screen.getByText(label)).toHaveClass(`LogRow__level--${level}`);
        });

        test('should fall back to a truncated label for levels without a config entry', () => {
            renderLogRow({log: {...baseLog, level: LogLevelEnum.SILLY}});

            const level = screen.getByText('SIL');
            expect(level).toBeInTheDocument();
            expect(level).toHaveClass('LogRow__level--debug');
        });
    });

    describe('level and wrap classes', () => {
        test('should add the error background class for error rows', () => {
            renderLogRow({log: {...baseLog, level: LogLevelEnum.ERROR}});

            const row = getRow();
            expect(row).toHaveClass('LogRow--error-bg');
            expect(row).not.toHaveClass('LogRow--warn-bg');
        });

        test('should add the warn background class for warn rows', () => {
            renderLogRow({log: {...baseLog, level: LogLevelEnum.WARN}});

            const row = getRow();
            expect(row).toHaveClass('LogRow--warn-bg');
            expect(row).not.toHaveClass('LogRow--error-bg');
        });

        test('should not add a background class for other levels', () => {
            renderLogRow();

            const row = getRow();
            expect(row).not.toHaveClass('LogRow--error-bg');
            expect(row).not.toHaveClass('LogRow--warn-bg');
        });

        test('should toggle between the wrap and nowrap classes', () => {
            const {rerender} = renderLogRow({wrapText: false});

            expect(getRow()).toHaveClass('LogRow--nowrap');

            rerender(
                <LogRow
                    {...defaultProps}
                    wrapText={true}
                />,
            );

            expect(getRow()).toHaveClass('LogRow--wrap');
            expect(getRow()).not.toHaveClass('LogRow--nowrap');
        });

        test('should add the focused and expanded classes when set', () => {
            renderLogRow({isExpanded: true, isFocused: true});

            const row = getRow();
            expect(row).toHaveClass('LogRow--expanded');
            expect(row).toHaveClass('LogRow--focused');
        });
    });

    describe('expand and collapse', () => {
        test('should call onToggleExpand with the log when the row is clicked', async () => {
            renderLogRow();

            await userEvent.click(getRowSummary());

            expect(defaultProps.onToggleExpand).toHaveBeenCalledTimes(1);
            expect(defaultProps.onToggleExpand).toHaveBeenCalledWith(baseLog);
        });

        test.each(['{Enter}', ' '])('should call onToggleExpand when %s is pressed', async (key) => {
            renderLogRow();

            getRowSummary().focus();
            await userEvent.keyboard(key);

            expect(defaultProps.onToggleExpand).toHaveBeenCalledTimes(1);
            expect(defaultProps.onToggleExpand).toHaveBeenCalledWith(baseLog);
        });

        test('should not call onToggleExpand for other keys', async () => {
            renderLogRow();

            getRowSummary().focus();
            await userEvent.keyboard('{ArrowDown}');

            expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
        });

        test('should reflect the expanded state on aria-expanded', () => {
            const {rerender} = renderLogRow({isExpanded: false});

            expect(getRowSummary()).toHaveAttribute('aria-expanded', 'false');

            rerender(
                <LogRow
                    {...defaultProps}
                    isExpanded={true}
                />,
            );

            expect(getRowSummary()).toHaveAttribute('aria-expanded', 'true');
        });

        test('should expose the row as a list item wrapping a disclosure control', () => {
            renderLogRow();

            const summary = getRowSummary();
            expect(getRow()).toContainElement(summary);
            expect(summary).toHaveAttribute('role', 'button');
            expect(summary).toHaveAttribute('tabindex', '0');

            // aria-expanded belongs on the control, not on the list item
            expect(getRow()).not.toHaveAttribute('aria-expanded');
        });

        test('should keep the copy controls outside the disclosure control', () => {
            renderLogRow({isExpanded: true});

            // Nesting them inside would make the buttons unreachable by keyboard
            expect(getRowSummary()).not.toContainElement(screen.getByText('Copy JSON'));
        });

        test('should call onFocus with the log when the row receives focus', () => {
            renderLogRow();

            fireEvent.focus(getRowSummary());

            expect(defaultProps.onFocus).toHaveBeenCalledWith(baseLog);
        });

        test('should only render the details when expanded', () => {
            const {rerender} = renderLogRow({isExpanded: false});

            expect(document.querySelector('.LogRow__details')).not.toBeInTheDocument();

            rerender(
                <LogRow
                    {...defaultProps}
                    isExpanded={true}
                />,
            );

            expect(document.querySelector('.LogRow__details')).toBeInTheDocument();
        });
    });

    describe('search term highlighting', () => {
        test('should not render any highlight without a search term', () => {
            renderLogRow({searchTerm: ''});

            expect(document.querySelectorAll('mark')).toHaveLength(0);
        });

        test('should wrap matched text in a highlight mark', () => {
            renderLogRow({searchTerm: 'happened'});

            const marks = document.querySelectorAll('mark.LogRow__highlight');
            expect(marks).toHaveLength(1);
            expect(marks[0]).toHaveTextContent('happened');
        });

        test('should match case insensitively but preserve the original casing', () => {
            renderLogRow({searchTerm: 'SOMETHING'});

            const marks = document.querySelectorAll('mark.LogRow__highlight');
            expect(marks).toHaveLength(1);
            expect(marks[0].textContent).toBe('Something');
        });

        test('should highlight every occurrence', () => {
            renderLogRow({
                log: {...baseLog, msg: 'error while handling error'},
                searchTerm: 'error',
            });

            expect(document.querySelectorAll('mark.LogRow__highlight')).toHaveLength(2);
        });

        test('should keep the full message readable when highlighting', () => {
            renderLogRow({searchTerm: 'happened'});

            expect(document.querySelector('.LogRow__message')).toHaveTextContent('Something happened');
        });

        test('should not highlight anything when the term does not match', () => {
            renderLogRow({searchTerm: 'nomatch'});

            expect(document.querySelectorAll('mark')).toHaveLength(0);
            expect(document.querySelector('.LogRow__message')).toHaveTextContent('Something happened');
        });
    });

    describe('expanded details', () => {
        test('should render the core fields', () => {
            renderLogRow({isExpanded: true});

            expect(screen.getByText('Timestamp')).toBeInTheDocument();
            expect(screen.getByText('Level')).toBeInTheDocument();
            expect(screen.getByText('Caller')).toBeInTheDocument();
            expect(screen.getByText('Message')).toBeInTheDocument();

            // The details show the unabbreviated timestamp and level
            expect(screen.getByText(baseLog.timestamp)).toBeInTheDocument();
            expect(screen.getByText('info')).toBeInTheDocument();
        });

        test('should render extra fields beyond timestamp, level, msg and caller', () => {
            renderLogRow({
                isExpanded: true,
                log: {...baseLog, request_id: 'req123', extra_detail: 'some value'},
            });

            expect(screen.getByText('request_id')).toBeInTheDocument();
            expect(screen.getByText('req123')).toBeInTheDocument();
            expect(screen.getByText('extra_detail')).toBeInTheDocument();
            expect(screen.getByText('some value')).toBeInTheDocument();

            // Required fields of a log object are extra fields too
            expect(screen.getByText('job_id')).toBeInTheDocument();
            expect(screen.getByText('worker')).toBeInTheDocument();
        });

        test('should not repeat the core fields in the extra fields grid', () => {
            renderLogRow({isExpanded: true});

            const extraKeys = Array.from(document.querySelectorAll('.LogRow__details-grid .LogRow__detail-label')).
                map((label) => label.textContent);

            expect(extraKeys).toEqual(['job_id', 'worker']);
        });

        test('should skip extra fields with null or undefined values', () => {
            renderLogRow({
                isExpanded: true,
                log: {...baseLog, empty_field: null, missing_field: undefined, kept_field: 'kept'},
            });

            expect(screen.getByText('kept_field')).toBeInTheDocument();
            expect(screen.queryByText('empty_field')).not.toBeInTheDocument();
            expect(screen.queryByText('missing_field')).not.toBeInTheDocument();
        });

        test('should not render the extra fields grid when there are none', () => {
            const {caller, level, msg, timestamp} = baseLog;
            renderLogRow({
                isExpanded: true,
                log: {caller, level, msg, timestamp} as LogObjectWithAdditionalInfo,
            });

            expect(document.querySelector('.LogRow__details-grid')).not.toBeInTheDocument();
        });

        test('should link IDs that resolve to an admin console page', () => {
            const userId = 'abcdefghijklmnopqrstuvwxyz';
            renderLogRow({isExpanded: true, log: {...baseLog, user_id: userId}});

            expect(screen.getByText(userId).closest('a')).toHaveAttribute(
                'href',
                `/admin_console/user_management/user/${userId}`,
            );
        });

        test('should not link values that are not valid Mattermost IDs', () => {
            renderLogRow({isExpanded: true, log: {...baseLog, user_id: 'not-an-id'}});

            expect(screen.getByText('not-an-id').closest('a')).toBeNull();
        });

        test('should not link ID fields without an admin console page', () => {
            const postId = 'abcdefghijklmnopqrstuvwxyz';
            renderLogRow({isExpanded: true, log: {...baseLog, post_id: postId}});

            expect(screen.getByText(postId).closest('a')).toBeNull();
        });
    });

    describe('copying', () => {
        test('should copy the log as JSON', async () => {
            renderLogRow({isExpanded: true});

            await userEvent.click(screen.getByText('Copy JSON'));

            expect(writeText).toHaveBeenCalledWith(JSON.stringify(baseLog, undefined, 2));
        });

        test('should copy the log line in the expected format', async () => {
            renderLogRow({isExpanded: true});

            await userEvent.click(screen.getByText('Copy log line'));

            expect(writeText).toHaveBeenCalledWith(
                '2024-01-01 12:34:56.789 +00:00 [INFO] Something happened (app/server.go:123)',
            );
        });

        test('should copy the value of a copyable extra field', async () => {
            renderLogRow({isExpanded: true, log: {...baseLog, request_id: 'req123'}});

            const requestIdValue = screen.getByText('req123');
            await userEvent.click(requestIdValue.querySelector('.LogRow__copy-btn')!);

            expect(writeText).toHaveBeenCalledWith('req123');
        });

        test('should show copy feedback and reset it after the timeout', async () => {
            jest.useFakeTimers();

            try {
                renderLogRow({isExpanded: true});

                fireEvent.click(screen.getByText('Copy JSON'));

                // Flush the clipboard promise so the success state is applied
                await act(async () => {});

                expect(screen.getByText('Copied!')).toBeInTheDocument();
                expect(screen.queryByText('Copy JSON')).not.toBeInTheDocument();

                act(() => {
                    jest.advanceTimersByTime(2000);
                });

                expect(screen.getByText('Copy JSON')).toBeInTheDocument();
                expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
            } finally {
                jest.useRealTimers();
            }
        });

        test('should not show copy feedback when the clipboard is unavailable', async () => {
            writeText.mockRejectedValue(new Error('denied'));
            renderLogRow({isExpanded: true});

            await userEvent.click(screen.getByText('Copy JSON'));

            expect(screen.getByText('Copy JSON')).toBeInTheDocument();
            expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
        });

        test('should not expand the row when a copy button is clicked', async () => {
            renderLogRow({isExpanded: true, log: {...baseLog, request_id: 'req123'}});

            await userEvent.click(screen.getByText('Copy JSON'));
            await userEvent.click(screen.getByText('Copy log line'));
            await userEvent.click(screen.getByText('req123').querySelector('.LogRow__copy-btn')!);

            expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
        });

        test('should not expand the row when the details area is clicked', async () => {
            renderLogRow({isExpanded: true});

            await userEvent.click(screen.getByText('Message'));

            expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
        });

        test('should not expand the row when an admin console link is clicked', async () => {
            const userId = 'abcdefghijklmnopqrstuvwxyz';
            renderLogRow({isExpanded: true, log: {...baseLog, user_id: userId}});

            await userEvent.click(screen.getByText(userId));

            expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
        });
    });

    describe('c keyboard shortcut', () => {
        test('should copy the log as JSON when c is pressed', async () => {
            renderLogRow();

            getRowSummary().focus();
            await userEvent.keyboard('c');

            await waitFor(() => {
                expect(writeText).toHaveBeenCalledWith(JSON.stringify(baseLog, undefined, 2));
            });
            expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
        });

        test('should show copy feedback when the row is expanded', async () => {
            renderLogRow({isExpanded: true});

            getRowSummary().focus();
            await userEvent.keyboard('c');

            await waitFor(() => {
                expect(screen.getByText('Copied!')).toBeInTheDocument();
            });
        });

        test.each(['{Control>}c{/Control}', '{Meta>}c{/Meta}'])(
            'should not copy for %s so the native copy still works',
            async (keys) => {
                renderLogRow();

                getRowSummary().focus();
                await userEvent.keyboard(keys);

                expect(writeText).not.toHaveBeenCalled();
            },
        );

        test('should ignore key presses coming from interactive descendants', async () => {
            renderLogRow({isExpanded: true});

            const copyJsonButton = screen.getByText('Copy JSON').closest('button')!;
            copyJsonButton.focus();
            await userEvent.keyboard('c');

            expect(writeText).not.toHaveBeenCalled();
            expect(defaultProps.onToggleExpand).not.toHaveBeenCalled();
        });
    });
});
