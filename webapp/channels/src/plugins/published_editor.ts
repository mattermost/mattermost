// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    PublishedEditorComponentId,
    PublishedEditorComponentProps,
    PublishedEditorUtils,
    PublishedSuggestionProviderConstructors,
} from '@mattermost/shared/types/global';

import AtMentionProvider from 'components/suggestion/at_mention_provider/at_mention_provider';
import ChannelMentionProvider from 'components/suggestion/channel_mention_provider';
import CommandProvider from 'components/suggestion/command_provider/command_provider';
import EmoticonProvider from 'components/suggestion/emoticon_provider';

function lazyEditorComponent<P extends object>(loader: () => Promise<{default: React.ComponentType<P>}>): React.FunctionComponent<P> {
    const LazyComponent = React.lazy(loader) as unknown as React.ComponentType<P>;

    const Wrapped = (props: P) => {
        return React.createElement(React.Suspense, {fallback: null}, React.createElement(LazyComponent, props));
    };

    return Wrapped;
}

const publishedEditorComponents = {
    wysiwyg_editor: lazyEditorComponent(() => import('components/advanced_text_editor/wysiwyg_editor/wysiwyg_editor')),
    suggestion_list: lazyEditorComponent(() => import('components/suggestion/suggestion_list')),
    formatting_bar: lazyEditorComponent(() => import('components/advanced_text_editor/formatting_bar/formatting_bar')),
} satisfies Record<PublishedEditorComponentId, React.ComponentType<any>>;

type ContractHonored<T extends {[K in PublishedEditorComponentId]: Omit<React.ComponentProps<(typeof publishedEditorComponents)[K]>, 'ref'>}> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertPublishedEditorContract = ContractHonored<PublishedEditorComponentProps>;

export const publishedSuggestionProviders: PublishedSuggestionProviderConstructors = {
    AtMention: AtMentionProvider,
    ChannelMention: ChannelMentionProvider,
    Command: CommandProvider,
    Emoticon: EmoticonProvider,
};

export const publishedEditorUtils: PublishedEditorUtils = {
    WysiwygEditor: publishedEditorComponents.wysiwyg_editor,
    SuggestionList: publishedEditorComponents.suggestion_list,
    FormattingBar: publishedEditorComponents.formatting_bar,
    providers: publishedSuggestionProviders,
};

const publishedEditorComponentIds = new Set<string>(Object.keys(publishedEditorComponents));

export function isPublishedEditorComponent(id: string): id is PublishedEditorComponentId {
    return publishedEditorComponentIds.has(id);
}
