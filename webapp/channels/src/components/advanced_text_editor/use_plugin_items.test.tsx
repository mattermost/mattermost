// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';

import {testPluginComponentErrorHandling} from 'tests/helpers/plugin_error_handling';
import {renderWithContext} from 'tests/react_testing_utils';

import type {PostDraft} from 'types/store/draft';

import usePluginItems from './use_plugin_items';

describe('components/advanced_text_editor/use_plugin_items', () => {
    const draft = {
        message: '',
        fileInfos: [],
        uploadsInProgress: [],
        createAt: 0,
        updateAt: 0,
        channelId: 'channel1',
        rootId: '',
        metadata: {},
    } as PostDraft;

    // Host component that renders the plugin items returned by the hook so they can be exercised.
    function TestHost() {
        const textboxRef = useRef(null) as any;
        const items = usePluginItems(draft, textboxRef, jest.fn());
        return <div>{items}</div>;
    }

    testPluginComponentErrorHandling((pluginComponent) => {
        renderWithContext(
            <TestHost/>,
            {
                plugins: {
                    components: {
                        PostEditorAction: [pluginComponent],
                    },
                },
            } as any,
        );
    });
});
