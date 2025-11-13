// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactRenderer} from '@tiptap/react';
import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';
import ReactDOM from 'react-dom';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import store from 'stores/redux_store';

import AtMentionProvider from 'components/suggestion/at_mention_provider';
import AtMentionSuggestion from 'components/suggestion/at_mention_provider/at_mention_suggestion';
import type {Item} from 'components/suggestion/at_mention_provider/at_mention_suggestion';

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
            return new Promise((resolve) => {
                let callbackCount = 0;
                let pendingTimeout: NodeJS.Timeout | null = null;

                provider.handlePretextChanged(`@${query}`, (results: any) => {
                    callbackCount++;

                    if (!results || !results.groups) {
                        resolve([]);
                        return;
                    }

                    // Flatten all items from all groups
                    const allItems: Item[] = results.groups.flatMap((group: any) => {
                        return group.items || [];
                    });

                    // Check if this looks like the "final" callback by checking for nonMembers group
                    const hasNonMembers = results.groups.some((g: any) => g.key === 'nonMembers');
                    const isFirstCallback = callbackCount === 1;

                    // Clear any pending timeout
                    if (pendingTimeout) {
                        clearTimeout(pendingTimeout);
                        pendingTimeout = null;
                    }

                    // If this is the first callback and has no nonMembers, wait for second callback
                    if (isFirstCallback && !hasNonMembers && allItems.length > 0) {
                        pendingTimeout = setTimeout(() => {
                            resolve(allItems);
                        }, 150);
                        return;
                    }

                    // This is either the second callback or has nonMembers (final result)
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

            let startTime = 0;
            const MIN_DISPLAY_TIME = 100;

            return {
                onStart: (mentionProps: any) => {
                    startTime = Date.now();

                    const {items, command, clientRect} = mentionProps;
                    currentItems = items || [];
                    currentSelectedIndex = 0;
                    commandFunction = command;

                    popup = document.createElement('div');
                    popup.className = 'tiptap-mention-popup';
                    document.body.appendChild(popup);

                    clickOutsideHandler = (event: MouseEvent) => {
                        if (popup && !popup.contains(event.target as Node)) {
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
                        if (component && component.updateProps) {
                            component.updateProps({...mentionProps, items: currentItems, selectedIndex: newIndex});
                        }
                        scrollSelectedIntoView(newIndex);
                        return true;
                    }

                    if (event.key === 'ArrowDown') {
                        const newIndex = currentSelectedIndex < currentItems.length - 1 ? currentSelectedIndex + 1 : 0;
                        currentSelectedIndex = newIndex;
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
                            commandFunction(commandData);
                            closePopup();
                            return true;
                        }
                    }

                    return false;
                },

                onExit: () => {
                    const elapsedTime = Date.now() - startTime;

                    // Prevent immediate closure due to race conditions
                    if (elapsedTime < MIN_DISPLAY_TIME && popup && component) {
                        return;
                    }

                    closePopup();
                },
            };
        },
    };
}
