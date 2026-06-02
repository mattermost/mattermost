// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {uploadFile} from 'actions/file_actions';

import testConfigureStore from 'tests/test_store';

jest.mock('selectors/general', () => ({
    ...jest.requireActual('selectors/general'),
    getConnectionId: jest.fn(() => ''),
}));

jest.mock('utils/utils', () => ({
    ...jest.requireActual('utils/utils'),
    localizeMessage: jest.fn((descriptor: {id: string; defaultMessage: string}) => descriptor.defaultMessage || descriptor.id),
}));

class MockXMLHttpRequest {
    status = 0;
    readyState = 0;
    response = '';
    upload: {onprogress?: (event: ProgressEvent) => void} = {};
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    open = jest.fn();
    setRequestHeader = jest.fn();
    send = jest.fn();
}

describe('actions/file_actions', () => {
    describe('uploadFile', () => {
        const originalXHR = window.XMLHttpRequest;
        let mockXhr: MockXMLHttpRequest;

        beforeEach(() => {
            mockXhr = new MockXMLHttpRequest();
            window.XMLHttpRequest = jest.fn(() => mockXhr) as unknown as typeof XMLHttpRequest;
        });

        afterEach(() => {
            window.XMLHttpRequest = originalXHR;
        });

        function startUpload(onError: jest.Mock) {
            const store = testConfigureStore();
            store.dispatch(uploadFile({
                file: new File(['data'], 'secret.tdf'),
                name: 'secret.tdf',
                type: 'application/octet-stream',
                rootId: 'root1',
                channelId: 'channel1',
                clientId: 'client1',
                onProgress: jest.fn(),
                onSuccess: jest.fn(),
                onError,
            }));
        }

        test('suppresses the inline error on plugin rejection by passing an empty message', () => {
            const onError = jest.fn();
            startUpload(onError);

            mockXhr.status = 400;
            mockXhr.readyState = 4;
            mockXhr.response = JSON.stringify({
                id: 'app.upload.run_plugins_hook.rejected',
                message: 'Unable to upload the file. File rejected by plugin. blocked by policy',
            });
            mockXhr.onload!();

            expect(onError).toHaveBeenCalledWith('', 'client1', 'channel1', 'root1');
        });

        test('passes the original error message for non-plugin upload failures', () => {
            const onError = jest.fn();
            startUpload(onError);

            mockXhr.status = 400;
            mockXhr.readyState = 4;
            mockXhr.response = JSON.stringify({
                id: 'api.file.upload_file.too_large.app_error',
                message: 'File is too large',
            });
            mockXhr.onload!();

            expect(onError).toHaveBeenCalledWith('File is too large', 'client1', 'channel1', 'root1');
        });
    });
});
