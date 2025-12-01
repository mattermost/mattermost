// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MessagesOrFilesSelector from 'components/search_results/messages_or_files_selector';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

describe('components/search_results/MessagesOrFilesSelector', () => {
    test('should match snapshot, on messages selected', () => {
        const {container} = renderWithContext(
            <MessagesOrFilesSelector
                selected='messages'
                selectedFilter='code'
                messagesCounter='5'
                filesCounter='10'
                isFileAttachmentsEnabled={true}
                onChange={vi.fn()}
                onFilter={vi.fn()}
                onTeamChange={vi.fn()}
                crossTeamSearchEnabled={false}
            />,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot, on files selected', () => {
        const {container} = renderWithContext(
            <MessagesOrFilesSelector
                selected='files'
                selectedFilter='code'
                messagesCounter='5'
                filesCounter='10'
                isFileAttachmentsEnabled={true}
                onChange={vi.fn()}
                onFilter={vi.fn()}
                onTeamChange={vi.fn()}
                crossTeamSearchEnabled={false}
            />,
        );

        expect(container).toMatchSnapshot();
    });
    test('should match snapshot, without files tab', () => {
        const {container} = renderWithContext(
            <MessagesOrFilesSelector
                selected='files'
                selectedFilter='code'
                messagesCounter='5'
                filesCounter='10'
                isFileAttachmentsEnabled={false}
                onChange={vi.fn()}
                onFilter={vi.fn()}
                onTeamChange={vi.fn()}
                crossTeamSearchEnabled={false}
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
