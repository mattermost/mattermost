// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type React from 'react';

import {renderHookWithContext} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {PostDraft} from 'types/store/draft';

import useUploadFiles from './use_upload_files';

jest.mock('components/file_upload', () => () => null);
jest.mock('components/file_preview', () => () => null);

describe('useUploadFiles ABAC upload gate', () => {
    const channel = TestHelper.getChannelMock({id: 'channelid1channelid1channelid1', team_id: 'teamid1teamid1teamid1teamid1te'});
    const channelId = channel.id;
    const draft = {message: '', fileInfos: [], uploadsInProgress: [], channelId, rootId: ''} as unknown as PostDraft;

    function stateWithDecision(decision?: {allowed: boolean; evaluated: boolean}) {
        return {
            entities: {
                channels: {channels: {[channelId]: channel}},
                general: {
                    config: {FeatureFlagPermissionPolicies: 'true'},
                    license: {},
                },
                renderPermissions: {
                    byResource: decision ? {
                        channel: {
                            [channelId]: {
                                upload_file_attachment: {...decision, generation: 1, receivedAt: 1},
                            },
                        },
                    } : {},
                },
            },
        };
    }

    function renderUpload(initialState: ReturnType<typeof stateWithDecision>) {
        return renderHookWithContext(() => useUploadFiles(
            draft,
            '',
            channelId,
            false,
            {current: {}},
            false, // isDisabled
            {current: null} as any,
            jest.fn(),
            jest.fn(),
            jest.fn(),
            false, // isPostBeingEdited
        ), initialState);
    }

    test('renders the upload control enabled when policy allows upload', () => {
        const {result} = renderUpload(stateWithDecision({allowed: true, evaluated: true}));

        const [, fileUploadJSX] = result.current as [unknown, React.ReactElement];
        expect(fileUploadJSX.props.disabledByPolicy).toBe(false);
    });

    test('renders the upload control disabled when policy denies upload', () => {
        const {result} = renderUpload(stateWithDecision({allowed: false, evaluated: true}));

        const [, fileUploadJSX] = result.current as [unknown, React.ReactElement];
        expect(fileUploadJSX.props.disabledByPolicy).toBe(true);
    });

    test('renders the upload control enabled while no decision is cached', () => {
        const {result} = renderUpload(stateWithDecision());

        const [, fileUploadJSX] = result.current as [unknown, React.ReactElement];
        expect(fileUploadJSX.props.disabledByPolicy).toBe(false);
    });
});
