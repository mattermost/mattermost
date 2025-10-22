// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import ReactDOM from 'react-dom';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import type {SuggestionOptions} from '@tiptap/suggestion';
import type {ReactRenderer} from '@tiptap/react';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import store from 'stores/redux_store';
import {getCurrentLocale, getTranslations} from 'selectors/i18n';

import AtMentionProvider from 'components/suggestion/at_mention_provider';
import AtMentionSuggestion from 'components/suggestion/at_mention_provider/at_mention_suggestion';
import type {Item} from 'components/suggestion/at_mention_provider/at_mention_suggestion';
import type {ProviderResultsGroup} from 'components/suggestion/suggestion_results';

import './mention_suggestion_list.scss';

export type MentionBridgeProps = {
    channelId: string;
    teamId: string;
    currentUserId: string;
    autocompleteUsersInChannel: (prefix: string) => Promise<ActionResult>;
    searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined) => Promise<{data: any}>;
    autocompleteGroups: Group[] | null;
    useChannelMentions: boolean;
    priorityProfiles?: UserProfile[];
};

class MentionSuggestionList extends React.Component<{
    items: Item[];
    selectedIndex: number;
    selectItem: (index: number) => void;
}> {
    render() {
        const {items, selectedIndex, selectItem} = this.props;

        return (
            <ul className='tiptap-mention-suggestions'>
                {items.map((item, index) => (
                    <AtMentionSuggestion
                        key={item.username}
                        item={item}
                        isSelection={index === selectedIndex}
                        onClick={() => selectItem(index)}
                        onMouseMove={() => {}}
                        id={`tiptap-mention-${item.username}-${index}`}
                        term={''}
                        matchedPretext={''}
                    />
                ))}
            </ul>
        );
    }
}

export function createMMentionSuggestion(props: MentionBridgeProps): Partial<SuggestionOptions<Item>> {
    console.log('[MentionBridge] Creating provider with props:', {
        currentUserId: props.currentUserId,
        channelId: props.channelId,
        teamId: props.teamId,
        hasAutocompleteUsersInChannel: !!props.autocompleteUsersInChannel,
        hasSearchAssociatedGroupsForReference: !!props.searchAssociatedGroupsForReference,
        autocompleteGroupsCount: props.autocompleteGroups?.length || 0,
        useChannelMentions: props.useChannelMentions,
    });

    const provider = new AtMentionProvider({
        currentUserId: props.currentUserId,
        channelId: props.channelId,
        autocompleteUsersInChannel: (prefix: string) => props.autocompleteUsersInChannel(prefix),
        useChannelMentions: props.useChannelMentions,
        autocompleteGroups: props.autocompleteGroups,
        searchAssociatedGroupsForReference: (prefix: string) => props.searchAssociatedGroupsForReference(prefix, props.teamId, props.channelId),
        priorityProfiles: props.priorityProfiles,
    });

    return {
        items: async ({query}: {query: string}): Promise<Item[]> => {
            console.log('[MentionBridge] Fetching mentions for query:', query);
            return new Promise((resolve) => {
                provider.handlePretextChanged(`@${query}`, (results: any) => {
                    console.log('[MentionBridge] Raw results:', {
                        hasResults: !!results,
                        hasGroups: !!results?.groups,
                        resultsKeys: results ? Object.keys(results) : [],
                        groupsLength: results?.groups?.length || 0,
                    });

                    if (!results || !results.groups) {
                        console.log('[MentionBridge] No results or groups - returning empty array');
                        resolve([]);
                        return;
                    }

                    // Flatten all items from all groups
                    const allItems: Item[] = results.groups.flatMap((group: any) => {
                        console.log('[MentionBridge] Processing group:', {
                            key: group.key,
                            itemsCount: group.items?.length || 0,
                        });
                        return group.items || [];
                    });

                    console.log('[MentionBridge] Final results:', {
                        groupCount: results.groups.length,
                        totalItems: allItems.length,
                    });
                    resolve(allItems);
                });
            });
        },

        render: () => {
            let component: ReactRenderer<typeof MentionSuggestionList> | null = null;
            let popup: HTMLElement | null = null;

            return {
                onStart: (mentionProps: any) => {
                    console.log('[MentionBridge] onStart called with items:', mentionProps.items?.length || 0);
                    const {items, command, clientRect} = mentionProps;

                    popup = document.createElement('div');
                    popup.className = 'tiptap-mention-popup';
                    document.body.appendChild(popup);

                    // Set initial position
                    if (clientRect) {
                        const rect = clientRect();
                        if (rect) {
                            popup.style.top = `${rect.bottom + window.scrollY}px`;
                            popup.style.left = `${rect.left + window.scrollX}px`;
                        }
                    }

                    const MentionListComponent = MentionSuggestionList as any;

                    // Get locale and messages from Redux store for IntlProvider
                    const state = store.getState();
                    const locale = getCurrentLocale(state);
                    const messages = getTranslations(state, locale);

                    const renderComponent = (componentItems: any[], selectedIdx: number) => {
                        if (popup) {
                            console.log('[MentionBridge] Rendering component with:', {
                                itemsCount: componentItems.length,
                                selectedIdx,
                                items: componentItems.map((i) => i.username),
                            });
                            ReactDOM.render(
                                <Provider store={store}>
                                    <IntlProvider
                                        locale={locale}
                                        messages={messages}
                                    >
                                        <MentionListComponent
                                            items={componentItems}
                                            selectedIndex={selectedIdx}
                                            selectItem={(index: number) => {
                                                const item = componentItems[index];
                                                console.log('[MentionBridge] Item selected:', item);
                                                command({id: item.id || item.username, label: item.username});
                                            }}
                                        />
                                    </IntlProvider>
                                </Provider>,
                                popup,
                            );
                        }
                    };

                    component = {
                        updateProps: (newProps: any) => {
                            renderComponent(newProps.items || items, newProps.selectedIndex || 0);
                        },
                        destroy: () => {
                            if (popup && popup.parentNode) {
                                ReactDOM.unmountComponentAtNode(popup);
                                popup.parentNode.removeChild(popup);
                            }
                            popup = null;
                            component = null;
                        },
                    } as any;

                    renderComponent(items, 0);
                },

                onUpdate: (mentionProps: any) => {
                    if (component && component.updateProps) {
                        component.updateProps(mentionProps);
                    }

                    if (popup && mentionProps.clientRect) {
                        const rect = mentionProps.clientRect();
                        if (rect) {
                            popup.style.top = `${rect.bottom + window.scrollY}px`;
                            popup.style.left = `${rect.left + window.scrollX}px`;
                        }
                    }
                },

                onKeyDown: (mentionProps: any) => {
                    if (mentionProps.event.key === 'Escape') {
                        if (component && component.destroy) {
                            component.destroy();
                        }
                        return true;
                    }
                    return false;
                },

                onExit: () => {
                    if (component && component.destroy) {
                        component.destroy();
                    }
                },
            };
        },
    };
}
