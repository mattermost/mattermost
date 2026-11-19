// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import AdvancedCreateComment from './advanced_create_comment';

const mockAdvancedTextEditor = jest.fn(() => <div data-testid='advanced-text-editor'/>) as jest.Mock;

jest.mock('components/advanced_text_editor/advanced_text_editor', () => ({
    __esModule: true,
    default: (props: unknown) => mockAdvancedTextEditor(props),
}));

describe('AdvancedCreateComment', () => {
    it('forwards agent mode and the send slot to the editor', () => {
        const renderSendButton = () => null;
        mockAdvancedTextEditor.mockClear();

        renderWithContext(
            <AdvancedCreateComment
                channelId='channel-id'
                rootId='root-id'
                agentMode={true}
                renderSendButton={renderSendButton}
                hiddenControls={['priority', 'burnOnRead', 'attributes']}
            />,
        );

        expect(mockAdvancedTextEditor).toHaveBeenCalledWith(expect.objectContaining({
            agentMode: true,
            renderSendButton,
            hiddenControls: ['priority', 'burnOnRead', 'attributes'],
            channelId: 'channel-id',
            rootId: 'root-id',
            location: 'RHS_COMMENT',
        }));
    });
});
