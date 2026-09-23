// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {logError, LogErrorBarMode} from 'mattermost-redux/actions/errors';

import store from 'stores/redux_store';

import {AnnouncementBarTypes} from 'utils/constants';

import {registerGlobalErrorHandlers} from './global_error_handler';

jest.mock('stores/redux_store', () => ({
    __esModule: true,
    default: {dispatch: jest.fn()},
}));

jest.mock('mattermost-redux/actions/errors', () => ({
    ...jest.requireActual('mattermost-redux/actions/errors'),
    logError: jest.fn(() => ({type: 'MOCK_LOG_ERROR'})),
}));

function dispatchUnhandledRejection(reason: unknown) {
    const event = new Event('unhandledrejection');
    Object.defineProperty(event, 'reason', {value: reason});
    window.dispatchEvent(event);
}

describe('registerGlobalErrorHandlers', () => {
    beforeAll(() => {
        registerGlobalErrorHandlers();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should log an uncaught error', () => {
        const error = new Error('something broke');
        error.stack = 'stack trace';

        window.dispatchEvent(new ErrorEvent('error', {
            message: 'Uncaught Error: something broke',
            filename: 'https://example.com/static/main.js',
            lineno: 12,
            colno: 34,
            error,
        }));

        expect(logError).toHaveBeenCalledWith(
            {
                type: AnnouncementBarTypes.DEVELOPER,
                message: 'A JavaScript error in the webapp client has occurred. (msg: Uncaught Error: something broke, row: 12, col: 34).',
                stack: 'stack trace',
                url: 'https://example.com/static/main.js',
            },
            {errorBarMode: LogErrorBarMode.InDevMode},
        );
        expect(store.dispatch).toHaveBeenCalledTimes(1);
    });

    test('should ignore benign ResizeObserver errors', () => {
        window.dispatchEvent(new ErrorEvent('error', {
            message: 'ResizeObserver loop completed with undelivered notifications.',
        }));

        expect(logError).not.toHaveBeenCalled();
        expect(store.dispatch).not.toHaveBeenCalled();
    });

    test('should log an unhandled promise rejection thrown as an Error', () => {
        const reason = new Error('request failed');
        reason.stack = 'rejection stack';

        dispatchUnhandledRejection(reason);

        expect(logError).toHaveBeenCalledWith(
            {
                type: AnnouncementBarTypes.DEVELOPER,
                message: 'An unhandled promise rejection in the webapp client has occurred. (reason: request failed).',
                stack: 'rejection stack',
                url: undefined,
            },
            {errorBarMode: LogErrorBarMode.InDevMode},
        );
    });

    test('should log an unhandled promise rejection with a non-Error reason', () => {
        dispatchUnhandledRejection('rejected with a string');

        expect(logError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'An unhandled promise rejection in the webapp client has occurred. (reason: rejected with a string).',
                stack: undefined,
            }),
            {errorBarMode: LogErrorBarMode.InDevMode},
        );
    });
});
