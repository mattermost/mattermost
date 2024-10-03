// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import type {ShallowWrapper} from 'enzyme';
import React from 'react';
import {Provider} from 'react-redux';

import MessagesOrFilesSelector from 'components/search_results/messages_or_files_selector';

import mockStore from 'tests/test_store';

describe('components/search_results/MessagesOrFilesSelector', () => {
    const store = mockStore({});

    test('should match snapshot, on messages selected', () => {
        const wrapper: ShallowWrapper<any, any, any> = shallow(
            <Provider store={store}>
                <MessagesOrFilesSelector
                    selected='messages'
                    selectedFilter='code'
                    messagesCounter='5'
                    filesCounter='10'
                    isFileAttachmentsEnabled={true}
                    onChange={jest.fn()}
                    onFilter={jest.fn()}
                    onTeamChange={jest.fn()}
                    crossTeamSearchEnabled={false}
                />
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot, on files selected', () => {
        const wrapper: ShallowWrapper<any, any, any> = shallow(

            <Provider store={store}>
                <MessagesOrFilesSelector
                    selected='files'
                    selectedFilter='code'
                    messagesCounter='5'
                    filesCounter='10'
                    isFileAttachmentsEnabled={true}
                    onChange={jest.fn()}
                    onFilter={jest.fn()}
                    onTeamChange={jest.fn()}
                    crossTeamSearchEnabled={false}
                />
            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });
    test('should match snapshot, without files tab', () => {
        const wrapper: ShallowWrapper<any, any, any> = shallow(

            <Provider store={store}>
                <MessagesOrFilesSelector
                    selected='files'
                    selectedFilter='code'
                    messagesCounter='5'
                    filesCounter='10'
                    isFileAttachmentsEnabled={false}
                    onChange={jest.fn()}
                    onFilter={jest.fn()}
                    onTeamChange={jest.fn()}
                    crossTeamSearchEnabled={false}
                />

            </Provider>,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
