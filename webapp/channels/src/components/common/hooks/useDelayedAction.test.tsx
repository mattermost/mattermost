// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef} from 'react';

import {render, screen} from 'tests/react_testing_utils';

import {useDelayedAction} from './useDelayedAction';

jest.useFakeTimers();

describe('useDelayedAction', () => {
    const props = {
        firstAction: jest.fn(),
        secondAction: jest.fn(),
    };

    test('should trigger the action after the timeout when clicked once', () => {
        render(<TestComponent {...props}/>);

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(0);

        // Click once
        screen.getByText('start').click();

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);

        // Wait until the timeout ends
        jest.advanceTimersToNextTimer();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
    });

    test("should trigger the action after the timeout when clicked again after it's run once", () => {
        render(<TestComponent {...props}/>);

        // Click once
        screen.getByText('start').click();

        jest.advanceTimersToNextTimer();

        // Wait until the timeout ends
        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Click again
        screen.getByText('start').click();

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Wait until the timeout ends again
        jest.advanceTimersToNextTimer();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(1);
    });

    test('should trigger the action only once if clicked before the first timeout finished', () => {
        render(<TestComponent {...props}/>);

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Click once
        screen.getByText('start').click();

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Wait until part way through the timeout
        jest.advanceTimersByTime(5);

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Click again
        screen.getByText('start').click();

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Wait until the original timeout would've ended
        jest.advanceTimersByTime(5);

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Wait until the second timeout ended
        jest.advanceTimersByTime(5);

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(1);
    });

    test('should trigger the action only once if fireNow is called before the timeout finishes', () => {
        render(<TestComponent {...props}/>);

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(0);

        // Click once
        screen.getByText('start').click();

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);

        // Wait until part way through the timeout
        jest.advanceTimersByTime(5);

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(0);

        // Click the other button to fire the timeout immediately
        screen.getByText('fire now').click();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
    });

    test('should trigger the action after the timeout when clicked again after fireNow is called', () => {
        render(<TestComponent {...props}/>);

        // Click once
        screen.getByText('start').click();

        // Wait until part way through the timeout
        jest.advanceTimersByTime(5);

        // Click the other button to fire the timeout immediately
        screen.getByText('fire now').click();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Click again
        screen.getByText('start').click();

        expect(jest.getTimerCount()).toBe(1);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Wait until part way through the timeout again
        jest.advanceTimersByTime(5);

        // Click the other button to fire the timeout immediately again
        screen.getByText('fire now').click();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(1);
    });

    test('should not trigger the action if fireNow is called before startTimeout', () => {
        render(<TestComponent {...props}/>);

        // Click the other button to attempt to fire the timeout immediately
        screen.getByText('fire now').click();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(0);
        expect(props.secondAction).toHaveBeenCalledTimes(0);
    });

    test('should not trigger the action a second time if fireNow is called after the timeout finished', () => {
        render(<TestComponent {...props}/>);

        // Click once
        screen.getByText('start').click();

        jest.advanceTimersToNextTimer();

        // Wait until the timeout ends
        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(0);

        // Click the other button to attempt to fire the timeout immediately
        screen.getByText('fire now').click();

        expect(jest.getTimerCount()).toBe(0);
        expect(props.firstAction).toHaveBeenCalledTimes(1);
        expect(props.secondAction).toHaveBeenCalledTimes(0);
    });
});

function TestComponent({
    firstAction,
    secondAction,
}: {
    firstAction: () => void;
    secondAction: () => void;
}) {
    const first = useRef(true);

    const delayedAction = useDelayedAction(10);

    const startTimeout = useCallback(() => {
        if (first.current) {
            delayedAction.startTimeout(firstAction);

            first.current = false;
        } else {
            delayedAction.startTimeout(secondAction);
        }
    }, [firstAction, secondAction]);

    return (
        <div>
            <button onClick={startTimeout}>{'start'}</button>
            <button onClick={delayedAction.fireNow}>{'fire now'}</button>
        </div>
    );
}
