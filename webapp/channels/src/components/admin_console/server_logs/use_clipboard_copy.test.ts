// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from '@testing-library/react';

import {copyToClipboard} from 'utils/utils';

import useClipboardCopy from './use_clipboard_copy';

jest.mock('utils/utils', () => ({copyToClipboard: jest.fn()}));

describe('components/admin_console/server_logs/useClipboardCopy', () => {
    const writeText = jest.fn();

    function setClipboard(value: unknown) {
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value});
    }

    beforeEach(() => {
        jest.useFakeTimers();
        writeText.mockReset().mockResolvedValue(undefined);
        (copyToClipboard as jest.Mock).mockReset();
        setClipboard({writeText});
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should report a copy and reset after the feedback period', async () => {
        const {result} = renderHook(() => useClipboardCopy());

        await act(async () => result.current[1]('text'));

        expect(writeText).toHaveBeenCalledWith('text');
        expect(result.current[0]).toBe('copied');

        act(() => {
            jest.advanceTimersByTime(2000);
        });
        expect(result.current[0]).toBe('idle');
    });

    test('should report a failed copy', async () => {
        writeText.mockRejectedValue(new Error('denied'));
        const {result} = renderHook(() => useClipboardCopy());

        await act(async () => result.current[1]('text'));

        expect(result.current[0]).toBe('failed');
    });

    test('should fall back to the shared copy without the Clipboard API', async () => {
        setClipboard(undefined);
        const {result} = renderHook(() => useClipboardCopy());

        await act(async () => result.current[1]('text'));

        expect(copyToClipboard).toHaveBeenCalledWith('text');
        expect(result.current[0]).toBe('copied');
    });
});
