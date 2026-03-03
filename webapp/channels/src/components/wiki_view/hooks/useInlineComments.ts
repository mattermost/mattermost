// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {openWikiRhs} from 'actions/views/rhs';
import {setPendingInlineAnchor} from 'actions/views/wiki_rhs';

import type {InlineAnchor} from 'types/store/pages';

export const useInlineComments = (pageId?: string, wikiId?: string) => {
    const dispatch = useDispatch();

    const handleCreateInlineComment = useCallback((anchor: InlineAnchor) => {
        if (!pageId || !wikiId) {
            return;
        }

        dispatch(setPendingInlineAnchor({
            anchor_id: anchor.anchor_id,
            text: anchor.text,
        }));
        dispatch(openWikiRhs(pageId, wikiId));
    }, [dispatch, pageId, wikiId]);

    return {
        handleCreateInlineComment,
    };
};
