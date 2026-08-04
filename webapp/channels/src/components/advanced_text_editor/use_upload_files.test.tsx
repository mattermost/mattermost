// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react';
import React from 'react';
import {Provider} from 'react-redux';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';

import {useRenderPermission} from 'components/common/hooks/useRenderPermission';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import useUploadFiles from './use_upload_files';

jest.mock('components/common/hooks/useRenderPermission', () => ({
    useRenderPermission: jest.fn(),
}));
jest.mock('mattermost-redux/selectors/entities/channels', () => ({getChannel: jest.fn()}));
jest.mock('mattermost-redux/selectors/entities/roles', () => ({haveIChannelPermission: jest.fn()}));
jest.mock('selectors/i18n', () => ({getCurrentLocale: jest.fn(() => 'en')}));
jest.mock('components/file_upload', () => () => null);
jest.mock('components/file_preview', () => () => null);

const mockedUseRenderPermission = useRenderPermission as jest.Mock;

describe('useUploadFiles ABAC upload gate', () => {
    const channelId = 'channel-1';

    const createMockStore = (state: Partial<GlobalState> = {}) => ({
        getState: () => state,
        dispatch: jest.fn(),
        subscribe: jest.fn(),
        replaceReducer: jest.fn(),
        [Symbol.observable]: jest.fn(),
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
        <Provider store={createMockStore() as any}>{children}</Provider>
    );

    const draft = {message: '', fileInfos: [], uploadsInProgress: [], channelId, rootId: ''} as unknown as PostDraft;

    const renderUpload = () => renderHook(() => useUploadFiles(
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
    ), {wrapper});

    beforeEach(() => {
        (getChannel as jest.Mock).mockReturnValue(undefined);
        (haveIChannelPermission as jest.Mock).mockReturnValue(true);
        mockedUseRenderPermission.mockReset();
    });

    test('renders the upload control enabled when policy allows upload', () => {
        mockedUseRenderPermission.mockReturnValue({allowed: true, evaluated: true, loading: false});
        const {result} = renderUpload();
        const [, fileUploadJSX] = result.current as [unknown, React.ReactElement];
        expect(fileUploadJSX).not.toBeNull();
        expect(fileUploadJSX.props.forceDisabled).toBe(false);
    });

    test('renders the upload control disabled when policy denies upload (evaluated)', () => {
        mockedUseRenderPermission.mockReturnValue({allowed: false, evaluated: true, loading: false, reason: 'restricted_by_policy'});
        const {result} = renderUpload();
        const [, fileUploadJSX] = result.current as [unknown, React.ReactElement];
        expect(fileUploadJSX).not.toBeNull();
        expect(fileUploadJSX.props.forceDisabled).toBe(true);
    });

    test('renders the upload control enabled while the decision is not yet evaluated', () => {
        mockedUseRenderPermission.mockReturnValue({allowed: undefined, evaluated: false, loading: true});
        const {result} = renderUpload();
        const [, fileUploadJSX] = result.current as [unknown, React.ReactElement];
        expect(fileUploadJSX).not.toBeNull();
        expect(fileUploadJSX.props.forceDisabled).toBe(false);
    });
});
