// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Client4} from 'mattermost-redux/client';

import * as FileUtils from 'mattermost-redux/utils/file_utils';
import TestHelper from '../../test/test_helper';

describe('FileUtils', () => {
    const serverUrl = Client4.getUrl();
    beforeEach(() => {
        Client4.setUrl('localhost');
    });

    afterEach(() => {
        Client4.setUrl(serverUrl);
    });

    it('getFileUrl', () => {
        expect(FileUtils.getFileUrl('id1')).toEqual('localhost/api/v4/files/id1');
        expect(FileUtils.getFileUrl('id2')).toEqual('localhost/api/v4/files/id2');
    });

    it('getFileDownloadUrl', () => {
        expect(FileUtils.getFileDownloadUrl('id1')).toEqual('localhost/api/v4/files/id1?download=1');
        expect(FileUtils.getFileDownloadUrl('id2')).toEqual('localhost/api/v4/files/id2?download=1');
    });

    it('getFileThumbnailUrl', () => {
        expect(FileUtils.getFileThumbnailUrl('id1')).toEqual('localhost/api/v4/files/id1/thumbnail');
        expect(FileUtils.getFileThumbnailUrl('id2')).toEqual('localhost/api/v4/files/id2/thumbnail');
    });

    it('getFilePreviewUrl', () => {
        expect(FileUtils.getFilePreviewUrl('id1')).toEqual('localhost/api/v4/files/id1/preview');
        expect(FileUtils.getFilePreviewUrl('id2')).toEqual('localhost/api/v4/files/id2/preview');
    });

    it('getFileMiniPreviewUrl', () => {
        expect(FileUtils.getFileMiniPreviewUrl(TestHelper.getFileInfoMock({}))).toEqual(undefined);
        expect(FileUtils.getFileMiniPreviewUrl(TestHelper.getFileInfoMock({mime_type: 'mime_type', mini_preview: 'mini_preview'}))).toEqual('data:mime_type;base64,mini_preview');
    });

    it('sortFileInfos', () => {
        const testCases = [
            {
                inputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                ],
                outputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                ],
            },
            {
                inputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                ],
                outputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                ],
            },
            {
                inputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                    TestHelper.getFileInfoMock({name: 'ccc', create_at: 300}),
                ],
                outputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                    TestHelper.getFileInfoMock({name: 'ccc', create_at: 300}),
                ],
            },
            {
                inputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'ccc', create_at: 300}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                ],
                outputFileInfos: [
                    TestHelper.getFileInfoMock({name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({name: 'bbb', create_at: 200}),
                    TestHelper.getFileInfoMock({name: 'ccc', create_at: 300}),
                ],
            },
            {
                inputFileInfos: [
                    TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({id: '2', name: 'aaa', create_at: 200}),
                ],
                outputFileInfos: [
                    TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({id: '2', name: 'aaa', create_at: 200}),
                ],
            },
            {
                inputFileInfos: [
                    TestHelper.getFileInfoMock({id: '2', name: 'aaa', create_at: 200}),
                    TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}),
                ],
                outputFileInfos: [
                    TestHelper.getFileInfoMock({id: '1', name: 'aaa', create_at: 100}),
                    TestHelper.getFileInfoMock({id: '2', name: 'aaa', create_at: 200}),
                ],
            },
        ];

        testCases.forEach((testCase) => {
            expect(FileUtils.sortFileInfos(testCase.inputFileInfos)).toEqual(testCase.outputFileInfos);
        });
    });
});
