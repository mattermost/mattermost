// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type TextboxClass from 'components/textbox/textbox';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

import type {EditorContext} from './advanced_text_editor';

const usePluginItems = (
    editor: EditorContext,
    draft: PostDraft,
    textboxRef: React.RefObject<TextboxClass>,
) => {
    const postEditorActions = useSelector((state: GlobalState) => state.plugins.components.PostEditorAction);

    const getSelectedText = useCallback(() => {
        const input = textboxRef.current?.getInputBox();

        return {
            start: input?.selectionStart,
            end: input?.selectionEnd,
        };
    }, [textboxRef]);

    const {overwriteMessage: setMessage} = editor;
    const items = useMemo(() => postEditorActions?.map((item) => {
        if (!item.component) {
            return null;
        }

        const Component = item.component as any;
        return (
            <Component
                key={item.id}
                draft={draft}
                getSelectedText={getSelectedText}
                updateText={setMessage}
            />
        );
    }), [postEditorActions, draft, getSelectedText, setMessage]);

    return items;
};

export default usePluginItems;
