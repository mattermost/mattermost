// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {act, renderHook} from 'tests/react_testing_utils';

import useLogPolling from './use_log_polling';

describe('components/admin_console/server_logs/useLogPolling', () => {
    const NOW = 1700000000000;

    let fetchLogs: jest.Mock;

    // Flushes the promises of an in-flight poll so the next tick is not skipped
    // by the re-entrancy guard
    const flush = async () => {
        await act(async () => {});
    };

    // Advances the fake timers and flushes the promises resolved by each tick
    const advance = async (ms: number) => {
        await flush();
        await act(async () => {
            jest.advanceTimersByTime(ms);
        });
        await flush();
    };

    const setHidden = (hidden: boolean) => {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => hidden,
        });
    };

    const dispatchVisibilityChange = async () => {
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
    };

    const renderPolling = (props: {enabled: boolean; intervalMs: number}) => {
        return renderHook(
            ({enabled, intervalMs}: {enabled: boolean; intervalMs: number}) => useLogPolling({
                fetchLogs,
                enabled,
                intervalMs,
            }),
            {initialProps: props},
        );
    };

    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(NOW);
        fetchLogs = jest.fn().mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.useRealTimers();

        // Remove the own property shadowing Document.prototype.hidden
        Reflect.deleteProperty(document, 'hidden');
    });

    describe('starting and stopping', () => {
        test('should not fetch while disabled', async () => {
            renderPolling({enabled: false, intervalMs: 5000});

            expect(fetchLogs).not.toHaveBeenCalled();

            await advance(20000);

            expect(fetchLogs).not.toHaveBeenCalled();
        });

        test('should fetch immediately when enabled', () => {
            renderPolling({enabled: true, intervalMs: 5000});

            expect(fetchLogs).toHaveBeenCalledTimes(1);
        });

        test('should fetch once per interval', async () => {
            renderPolling({enabled: true, intervalMs: 5000});

            expect(fetchLogs).toHaveBeenCalledTimes(1);

            await advance(5000);
            expect(fetchLogs).toHaveBeenCalledTimes(2);

            await advance(5000);
            expect(fetchLogs).toHaveBeenCalledTimes(3);
        });

        test('should not fetch before the interval elapses', async () => {
            renderPolling({enabled: true, intervalMs: 5000});

            await advance(4999);

            expect(fetchLogs).toHaveBeenCalledTimes(1);
        });

        test('should start polling when enabled is turned on', async () => {
            const {rerender} = renderPolling({enabled: false, intervalMs: 5000});

            expect(fetchLogs).not.toHaveBeenCalled();

            await act(async () => {
                rerender({enabled: true, intervalMs: 5000});
            });

            expect(fetchLogs).toHaveBeenCalledTimes(1);

            await advance(5000);

            expect(fetchLogs).toHaveBeenCalledTimes(2);
        });

        test('should stop polling when enabled is turned off', async () => {
            const {rerender} = renderPolling({enabled: true, intervalMs: 5000});

            await advance(5000);
            expect(fetchLogs).toHaveBeenCalledTimes(2);

            await act(async () => {
                rerender({enabled: false, intervalMs: 5000});
            });

            await advance(20000);

            expect(fetchLogs).toHaveBeenCalledTimes(2);
        });

        test('should stop polling on unmount', async () => {
            const {unmount} = renderPolling({enabled: true, intervalMs: 5000});

            await advance(5000);
            expect(fetchLogs).toHaveBeenCalledTimes(2);

            unmount();

            await advance(20000);

            expect(fetchLogs).toHaveBeenCalledTimes(2);
        });

        test('should always use the latest fetchLogs callback', async () => {
            const {rerender} = renderHook(
                ({fetch}: {fetch: () => Promise<void>}) => useLogPolling({
                    fetchLogs: fetch,
                    enabled: true,
                    intervalMs: 5000,
                }),
                {initialProps: {fetch: fetchLogs}},
            );

            const newFetchLogs = jest.fn().mockResolvedValue(undefined);
            await act(async () => {
                rerender({fetch: newFetchLogs});
            });

            await advance(5000);

            expect(newFetchLogs).toHaveBeenCalled();
            expect(fetchLogs).toHaveBeenCalledTimes(1);
        });
    });

    describe('interval changes', () => {
        test('should restart the timer with the new interval', async () => {
            const {rerender} = renderPolling({enabled: true, intervalMs: 30000});

            await act(async () => {
                rerender({enabled: true, intervalMs: 2000});
            });

            // Restarting the effect triggers an immediate fetch on top of the initial one
            expect(fetchLogs).toHaveBeenCalledTimes(2);

            await advance(2000);
            expect(fetchLogs).toHaveBeenCalledTimes(3);

            await advance(2000);
            expect(fetchLogs).toHaveBeenCalledTimes(4);
        });

        test('should not keep firing on the previous interval', async () => {
            const {rerender} = renderPolling({enabled: true, intervalMs: 2000});

            await act(async () => {
                rerender({enabled: true, intervalMs: 30000});
            });

            const callsAfterRestart = fetchLogs.mock.calls.length;

            await advance(29999);

            expect(fetchLogs).toHaveBeenCalledTimes(callsAfterRestart);

            await advance(1);

            expect(fetchLogs).toHaveBeenCalledTimes(callsAfterRestart + 1);
        });
    });

    describe('lastUpdated', () => {
        test('should be null before the first poll completes', () => {
            const {result} = renderPolling({enabled: false, intervalMs: 5000});

            expect(result.current.lastUpdated).toBeNull();
        });

        test('should be set after a successful poll', async () => {
            const {result} = renderPolling({enabled: true, intervalMs: 5000});

            // Flush the immediate fetch
            await act(async () => {});

            expect(result.current.lastUpdated).toBe(NOW);
        });

        test('should update after each poll', async () => {
            const {result} = renderPolling({enabled: true, intervalMs: 5000});

            await act(async () => {});
            expect(result.current.lastUpdated).toBe(NOW);

            await advance(5000);

            expect(result.current.lastUpdated).toBe(NOW + 5000);
        });

        test('should not update when the fetch rejects', async () => {
            const {result} = renderPolling({enabled: true, intervalMs: 5000});

            await act(async () => {});
            expect(result.current.lastUpdated).toBe(NOW);

            fetchLogs.mockRejectedValue(new Error('request failed'));

            await advance(5000);

            expect(result.current.lastUpdated).toBe(NOW);
        });

        test('should keep polling after a failed fetch', async () => {
            fetchLogs.mockRejectedValue(new Error('request failed'));

            renderPolling({enabled: true, intervalMs: 5000});

            await advance(5000);

            expect(fetchLogs).toHaveBeenCalledTimes(2);
        });
    });

    describe('overlapping polls', () => {
        test('should not start a new fetch while one is still in flight', async () => {
            let resolveFetch: () => void = () => {};
            fetchLogs.mockImplementation(() => new Promise<void>((resolve) => {
                resolveFetch = () => resolve();
            }));

            renderPolling({enabled: true, intervalMs: 5000});

            expect(fetchLogs).toHaveBeenCalledTimes(1);

            // The first fetch is still pending, so these ticks are skipped
            await advance(15000);
            expect(fetchLogs).toHaveBeenCalledTimes(1);

            await act(async () => {
                resolveFetch();
            });

            await advance(5000);

            expect(fetchLogs).toHaveBeenCalledTimes(2);
        });
    });

    describe('hidden tab', () => {
        test('should skip polling while the tab is hidden', async () => {
            renderPolling({enabled: true, intervalMs: 5000});

            expect(fetchLogs).toHaveBeenCalledTimes(1);

            setHidden(true);

            await advance(15000);

            expect(fetchLogs).toHaveBeenCalledTimes(1);
        });

        test('should resume polling when the tab becomes visible again', async () => {
            renderPolling({enabled: true, intervalMs: 5000});

            setHidden(true);
            await dispatchVisibilityChange();

            await advance(15000);
            expect(fetchLogs).toHaveBeenCalledTimes(1);

            setHidden(false);
            await dispatchVisibilityChange();

            // Becoming visible again fetches right away
            expect(fetchLogs).toHaveBeenCalledTimes(2);

            await advance(5000);
            expect(fetchLogs).toHaveBeenCalledTimes(3);
        });

        test('should not run two intervals after resuming', async () => {
            renderPolling({enabled: true, intervalMs: 5000});

            expect(jest.getTimerCount()).toBe(1);

            setHidden(true);
            await dispatchVisibilityChange();

            expect(jest.getTimerCount()).toBe(0);

            setHidden(false);
            await dispatchVisibilityChange();

            // Counting fetch calls cannot tell one interval from two here, because
            // the re-entrancy guard swallows the second of two simultaneous ticks
            expect(jest.getTimerCount()).toBe(1);
        });

        test('should ignore visibility changes while disabled', async () => {
            renderPolling({enabled: false, intervalMs: 5000});

            setHidden(false);
            await dispatchVisibilityChange();

            await advance(15000);

            expect(fetchLogs).not.toHaveBeenCalled();
        });

        test('should stop listening for visibility changes on unmount', async () => {
            const {unmount} = renderPolling({enabled: true, intervalMs: 5000});

            setHidden(true);
            await dispatchVisibilityChange();

            unmount();

            setHidden(false);
            await dispatchVisibilityChange();

            await advance(15000);

            expect(fetchLogs).toHaveBeenCalledTimes(1);
        });
    });
});
