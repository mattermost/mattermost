// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {
    PublishedEditorComponentId,
    PublishedEditorComponentProps,
    PublishedEditorUtils,
    PublishedFormattingBarHandle,
    PublishedSuggestionProviderConstructors,
    PublishedWysiwygEditorHandle,
} from '@mattermost/shared/types/global';

import type {FormattingBarHandle} from 'components/advanced_text_editor/formatting_bar/formatting_bar';
import type {WysiwygEditorHandle} from 'components/advanced_text_editor/wysiwyg_editor/wysiwyg_editor';
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

function lazyForwardRefEditorComponent<P extends object, R>(
    displayName: string,
    loader: () => Promise<{default: React.ComponentType<P>}>,
): React.ForwardRefExoticComponent<React.PropsWithoutRef<P> & React.RefAttributes<R>> {
    const LazyComponent = React.lazy(loader) as unknown as React.ComponentType<P>;

    const Wrapped = React.forwardRef<R, P>((props, ref) =>
        React.createElement(
            React.Suspense,
            {fallback: null},
            React.createElement(LazyComponent, {...props, ref} as unknown as P),
        ),
    );
    Wrapped.displayName = displayName;
    return Wrapped;
}

const publishedEditorComponents = {
    wysiwyg_editor: lazyForwardRefEditorComponent<PublishedEditorComponentProps['wysiwyg_editor'], PublishedWysiwygEditorHandle>(
        'PublishedWysiwygEditor',
        () => import('components/advanced_text_editor/wysiwyg_editor/wysiwyg_editor'),
    ),
    suggestion_list: lazyEditorComponent(() => import('components/suggestion/suggestion_list')),
    formatting_bar: lazyForwardRefEditorComponent<PublishedEditorComponentProps['formatting_bar'], PublishedFormattingBarHandle>(
        'PublishedFormattingBar',
        () => import('components/advanced_text_editor/formatting_bar/formatting_bar'),
    ),
} satisfies Record<PublishedEditorComponentId, React.ComponentType<any>>;

type ContractHonored<T extends {[K in PublishedEditorComponentId]: Omit<React.ComponentProps<(typeof publishedEditorComponents)[K]>, 'ref'>}> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertPublishedEditorContract = ContractHonored<PublishedEditorComponentProps>;

// Handle drift check: real handles must remain a superset of the published
// (narrower) handles. If a real handle drops a method the contract promises,
// the conditional collapses to `never`, which doesn't satisfy `AssertsTrue`.
type AssertsTrue<T extends true> = T;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertPublishedWysiwygEditorHandle = AssertsTrue<WysiwygEditorHandle extends PublishedWysiwygEditorHandle ? true : never>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type AssertPublishedFormattingBarHandle = AssertsTrue<FormattingBarHandle extends PublishedFormattingBarHandle ? true : never>;

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
