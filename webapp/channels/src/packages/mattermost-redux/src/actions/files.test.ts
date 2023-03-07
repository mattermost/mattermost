// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import fs from 'fs';

import nock from 'nock';

import {FileTypes} from 'mattermost-redux/action_types';
import * as Actions from 'mattermost-redux/actions/files';
import {Client4} from 'mattermost-redux/client';
import TestHelper from '../../test/test_helper';
import configureStore from '../../test/test_store';

describe('Actions.Files', () => {
    let store = configureStore();
    beforeAll(() => {
        TestHelper.initBasic(Client4);
    });

    beforeEach(() => {
        store = configureStore();
    });

    afterAll(() => {
        TestHelper.tearDown();
    });

    it('getFilesForPost', async () => {
        const {basicClient4, basicChannel} = TestHelper;
        const testFileName = 'test.png';
        const testImageData = fs.createReadStream(`src/packages/mattermost-redux/test/assets/images/${testFileName}`);
        const clientId = TestHelper.generateId();

        const imageFormData = new FormData();
        imageFormData.append('files', testImageData as any);
        imageFormData.append('channel_id', basicChannel!.id);
        imageFormData.append('client_ids', clientId);

        nock(Client4.getBaseRoute()).
            post('/files').
            reply(201, {file_infos: [{id: TestHelper.generateId(), user_id: TestHelper.basicUser!.id, create_at: 1507921547541, update_at: 1507921547541, delete_at: 0, name: 'test.png', extension: 'png', size: 258428, mime_type: 'image/png', width: 600, height: 600, has_preview_image: true}], client_ids: [TestHelper.generateId()]});

        const fileUploadResp = await basicClient4!.
            uploadFile(imageFormData);
        const fileId = fileUploadResp.file_infos[0].id;

        const fakePostForFile = TestHelper.fakePost(basicChannel!.id);
        fakePostForFile.file_ids = [fileId];

        nock(Client4.getBaseRoute()).
            post('/posts').
            reply(201, {...TestHelper.fakePostWithId('undefined'), ...fakePostForFile});
        const postForFile = await basicClient4!.createPost(fakePostForFile);

        nock(Client4.getBaseRoute()).
            get(`/posts/${postForFile.id}/files/info`).
            reply(200, [{id: fileId, user_id: TestHelper.basicUser!.id, create_at: 1507921547541, update_at: 1507921547541, delete_at: 0, name: 'test.png', extension: 'png', size: 258428, mime_type: 'image/png', width: 600, height: 600, has_preview_image: true}]);

        await Actions.getFilesForPost(postForFile.id)(store.dispatch, store.getState);

        const {files: allFiles, fileIdsByPostId} = store.getState().entities.files;

        expect(allFiles).toBeTruthy();
        expect(allFiles[fileId]).toBeTruthy();
        expect(allFiles[fileId].id).toEqual(fileId);
        expect(allFiles[fileId].name).toEqual(testFileName);

        expect(fileIdsByPostId).toBeTruthy();
        expect(fileIdsByPostId[postForFile.id]).toBeTruthy();
        expect(fileIdsByPostId[postForFile.id][0]).toEqual(fileId);
    });

    it('getFilePublicLink', async () => {
        const fileId = 't1izsr9uspgi3ynggqu6xxjn9y';
        nock(Client4.getBaseRoute()).
            get(`/files/${fileId}/link`).
            query(true).
            reply(200, {
                link: 'https://mattermost.com/files/ndans23ry2rtjd1z73g6i5f3fc/public?h=rE1-b2N1VVVMsAQssjwlfNawbVOwUy1TRDuTeGC_tys',
            });

        await Actions.getFilePublicLink(fileId)(store.dispatch, store.getState);

        const state = store.getState();

        const filePublicLink = state.entities.files.filePublicLink.link;
        expect('https://mattermost.com/files/ndans23ry2rtjd1z73g6i5f3fc/public?h=rE1-b2N1VVVMsAQssjwlfNawbVOwUy1TRDuTeGC_tys').toEqual(filePublicLink);
        expect(filePublicLink).toBeTruthy();
        expect(filePublicLink.length > 0).toBeTruthy();
    });

    it('receivedFiles', async () => {
        const files = {
            filename: {data: 'data'},
        };
        const result = Actions.receivedFiles(files as any);
        expect(result).toEqual({
            type: FileTypes.RECEIVED_FILES_FOR_SEARCH,
            data: files,
        });
    });
});
