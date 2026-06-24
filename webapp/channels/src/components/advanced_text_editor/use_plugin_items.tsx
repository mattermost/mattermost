// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useMemo} from 'react';
import {useSelector} from 'react-redux';

import type TextboxClass from 'components/textbox/textbox';

import PluggableErrorBoundary from 'plugins/pluggable/error_boundary';

import type {GlobalState} from 'types/store';
import type {PostDraft} from 'types/store/draft';

const usePluginItems = (
    draft: PostDraft,
    textboxRef: React.RefObject<TextboxClass>,
    handleDraftChange: (draft: PostDraft) => void,
) => {
    const postEditorActions = useSelector((state: GlobalState) => state.plugins.components.PostEditorAction);

    const getSelectedText = useCallback(() => {
        const input = textboxRef.current?.getInputBox();

        return {
            start: input?.selectionStart,
            end: input?.selectionEnd,
        };
    }, [textboxRef]);

    const updateText = useCallback((message: string) => {
        handleDraftChange({
            ...draft,
            message,
        });

        // Missing setting the state eventually?
    }, [handleDraftChange, draft]);

    const items = useMemo(() => {
        return postEditorActions?.map((item) => {
            if (!item.component) {
                return null;
            }

            const Component = item.component as any;
            return (
                <PluggableErrorBoundary
                    key={item.id}
                    pluginId={item.pluginId}
                >
                    <Component
                        draft={draft}
                        getSelectedText={getSelectedText}
                        updateText={updateText}
                    />
                </PluggableErrorBoundary>
            );
        });
    }, [postEditorActions, draft, getSelectedText, updateText]);

    return items;
};

export default usePluginItems;
