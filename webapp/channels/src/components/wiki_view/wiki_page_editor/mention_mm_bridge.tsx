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
    const creationTime = new Date().toISOString();
    console.log('[MentionBridge] Creating provider with props:', {
        currentUserId: props.currentUserId,
        channelId: props.channelId,
        teamId: props.teamId,
        hasAutocompleteUsersInChannel: !!props.autocompleteUsersInChannel,
        hasSearchAssociatedGroupsForReference: !!props.searchAssociatedGroupsForReference,
        autocompleteGroupsCount: props.autocompleteGroups?.length || 0,
        useChannelMentions: props.useChannelMentions,
        creationTime,
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

    console.log('[MentionBridge] Provider created at:', creationTime);

    let itemsCallCount = 0;

    return {
        items: async ({query}: {query: string}): Promise<Item[]> => {
            itemsCallCount++;
            const callNumber = itemsCallCount;
            const callStartTime = new Date().toISOString();
            const timeSinceCreation = Date.now() - new Date(creationTime).getTime();

            console.log('[MentionBridge] items() called:', {
                callNumber,
                query,
                queryLength: query.length,
                pretext: `@${query}`,
                callStartTime,
                timeSinceCreation: `${timeSinceCreation}ms`,
            });

            return new Promise((resolve) => {
                let callbackCount = 0;
                let pendingTimeout: NodeJS.Timeout | null = null;

                provider.handlePretextChanged(`@${query}`, (results: any) => {
                    callbackCount++;
                    const callbackTime = new Date().toISOString();
                    const callbackDelay = Date.now() - new Date(callStartTime).getTime();

                    console.log('[MentionBridge] Provider callback invoked:', {
                        callNumber,
                        callbackNumber: callbackCount,
                        query,
                        callbackTime,
                        callbackDelay: `${callbackDelay}ms`,
                        hasResults: !!results,
                        hasGroups: !!results?.groups,
                        resultsKeys: results ? Object.keys(results) : [],
                        groupsLength: results?.groups?.length || 0,
                        groupDetails: results?.groups?.map((g: any) => ({
                            key: g.key,
                            itemCount: g.items?.length || 0,
                            firstItem: g.items?.[0]?.username,
                        })),
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
                            items: group.items?.map((i: any) => i.username).slice(0, 5),
                        });
                        return group.items || [];
                    });

                    // Check if this looks like the "final" callback by checking for nonMembers group
                    const hasNonMembers = results.groups.some((g: any) => g.key === 'nonMembers');
                    const isFirstCallback = callbackCount === 1;

                    console.log('[MentionBridge] Callback analysis:', {
                        callNumber,
                        callbackNumber: callbackCount,
                        hasNonMembers,
                        isFirstCallback,
                        totalItems: allItems.length,
                        decision: hasNonMembers || !isFirstCallback ? 'RESOLVE NOW (final)' : 'WAIT for second callback',
                    });

                    // Clear any pending timeout
                    if (pendingTimeout) {
                        clearTimeout(pendingTimeout);
                        pendingTimeout = null;
                    }

                    // If this is the first callback and has no nonMembers, wait for second callback
                    if (isFirstCallback && !hasNonMembers && allItems.length > 0) {
                        console.log('[MentionBridge] First callback without nonMembers - waiting 150ms for final callback');
                        pendingTimeout = setTimeout(() => {
                            console.log('[MentionBridge] Timeout reached - resolving with current items:', {
                                callNumber,
                                totalItems: allItems.length,
                            });
                            resolve(allItems);
                        }, 150);
                        return;
                    }

                    // This is either the second callback or has nonMembers (final result)
                    console.log('[MentionBridge] Resolving with results:', {
                        callNumber,
                        callbackNumber: callbackCount,
                        query,
                        groupCount: results.groups.length,
                        totalItems: allItems.length,
                        allUsernames: allItems.map((i) => i.username),
                    });
                    resolve(allItems);
                });
            });
        },

        render: () => {
            let component: ReactRenderer<typeof MentionSuggestionList> | null = null;
            let popup: HTMLElement | null = null;
            let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;
            let currentItems: any[] = [];
            let currentSelectedIndex = 0;
            let commandFunction: ((attrs: any) => void) | null = null;

            const scrollSelectedIntoView = (index: number) => {
                setTimeout(() => {
                    const item = currentItems[index];
                    if (item && popup) {
                        const selectedElement = document.getElementById(`tiptap-mention-${item.username}-${index}`);
                        if (selectedElement) {
                            selectedElement.scrollIntoView({block: 'nearest', behavior: 'smooth'});
                        }
                    }
                }, 0);
            };

            const closePopup = () => {
                if (component && component.destroy) {
                    component.destroy();
                }
            };

            return {
                onStart: (mentionProps: any) => {
                    console.log('[MentionBridge] onStart called:', {
                        itemsCount: mentionProps.items?.length || 0,
                        usernames: mentionProps.items?.map((i: any) => i.username).slice(0, 10),
                        timestamp: new Date().toISOString(),
                    });
                    const {items, command, clientRect} = mentionProps;
                    currentItems = items || [];
                    currentSelectedIndex = 0;
                    commandFunction = command;

                    popup = document.createElement('div');
                    popup.className = 'tiptap-mention-popup';
                    document.body.appendChild(popup);

                    // Add click-outside handler to close the popup
                    clickOutsideHandler = (event: MouseEvent) => {
                        if (popup && !popup.contains(event.target as Node)) {
                            console.log('[MentionBridge] Click outside detected - closing popup');
                            closePopup();
                        }
                    };
                    document.addEventListener('mousedown', clickOutsideHandler, true);

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
                                selectedItem: componentItems[selectedIdx]?.username,
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
                                                console.log('[MentionBridge] Item clicked:', {
                                                    item,
                                                    id: item.id || item.username,
                                                    label: item.username,
                                                });
                                                if (commandFunction) {
                                                    commandFunction({id: item.id || item.username, label: item.username});
                                                }
                                                closePopup();
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
                            if (clickOutsideHandler) {
                                document.removeEventListener('mousedown', clickOutsideHandler, true);
                                clickOutsideHandler = null;
                            }
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
                    // Track current items and selection
                    if (mentionProps.items) {
                        currentItems = mentionProps.items;
                    }
                    if (mentionProps.selectedIndex !== undefined) {
                        currentSelectedIndex = mentionProps.selectedIndex;
                    }

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
                    const {event} = mentionProps;

                    if (event.key === 'Escape') {
                        closePopup();
                        return true;
                    }

                    if (event.key === 'ArrowUp') {
                        const newIndex = currentSelectedIndex > 0 ? currentSelectedIndex - 1 : currentItems.length - 1;
                        currentSelectedIndex = newIndex;
                        console.log('[MentionBridge] ArrowUp pressed:', {oldIndex: currentSelectedIndex, newIndex, itemsLength: currentItems.length});
                        if (component && component.updateProps) {
                            component.updateProps({...mentionProps, items: currentItems, selectedIndex: newIndex});
                        }
                        scrollSelectedIntoView(newIndex);
                        return true;
                    }

                    if (event.key === 'ArrowDown') {
                        const newIndex = currentSelectedIndex < currentItems.length - 1 ? currentSelectedIndex + 1 : 0;
                        currentSelectedIndex = newIndex;
                        console.log('[MentionBridge] ArrowDown pressed:', {oldIndex: currentSelectedIndex, newIndex, itemsLength: currentItems.length});
                        if (component && component.updateProps) {
                            component.updateProps({...mentionProps, items: currentItems, selectedIndex: newIndex});
                        }
                        scrollSelectedIntoView(newIndex);
                        return true;
                    }

                    if (event.key === 'Enter' || event.key === 'Tab') {
                        const item = currentItems[currentSelectedIndex];
                        if (item && commandFunction) {
                            const commandData = {id: item.id || item.username, label: item.username};
                            console.log('[MentionBridge] Enter/Tab pressed:', {
                                key: event.key,
                                item,
                                commandData,
                                hasCommand: !!commandFunction,
                            });
                            commandFunction(commandData);
                            closePopup();
                            return true;
                        }
                        console.log('[MentionBridge] Enter/Tab pressed but no item or command:', {
                            hasItem: !!item,
                            hasCommand: !!commandFunction,
                            currentSelectedIndex,
                            itemsLength: currentItems.length,
                        });
                    }

                    return false;
                },

                onExit: () => {
                    closePopup();
                },
            };
        },
    };
}
