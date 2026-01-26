// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/core';
import type {ReactRenderer} from '@tiptap/react';
import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';
import ReactDOM from 'react-dom';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import store from 'stores/redux_store';

import ChannelMentionProvider, {ChannelMentionSuggestion} from 'components/suggestion/channel_mention_provider';

import './mention_suggestion_list.scss';

export type ChannelMentionBridgeProps = {
    channelId: string;
    teamId: string;
    autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error: () => void) => Promise<ActionResult>;
    delayChannelAutocomplete?: boolean;
};

class ChannelMentionSuggestionList extends React.Component<{
    items: Channel[];
    selectedIndex: number;
    selectItem: (index: number) => void;
}> {
    render() {
        const {items, selectedIndex, selectItem} = this.props;

        return (
            <ul className='tiptap-mention-suggestions tiptap-channel-mention-suggestions'>
                {items.map((item, index) => (
                    <ChannelMentionSuggestion
                        key={item.id}
                        item={item}
                        isSelection={index === selectedIndex}
                        onClick={() => selectItem(index)}
                        onMouseMove={() => {}}
                        id={`tiptap-channel-mention-${item.name}-${index}`}
                        term={''}
                        matchedPretext={''}
                    />
                ))}
            </ul>
        );
    }
}

export function createChannelMentionSuggestion(props: ChannelMentionBridgeProps): Partial<SuggestionOptions<Channel>> {
    const provider = new ChannelMentionProvider(
        props.autocompleteChannels,
        props.delayChannelAutocomplete ?? false,
    );

    let activeQuery: string | null = null;

    return {
        char: '~',

        items: async ({query}: {query: string; editor: Editor}): Promise<Channel[]> => {
            // Cancel previous query if a new one comes in
            if (activeQuery !== null && activeQuery !== query) {
                // Query changed, previous query cancelled
            }
            activeQuery = query;

            return new Promise((resolve) => {
                let callbackCount = 0;
                let pendingTimeout: NodeJS.Timeout | null = null;

                provider.handlePretextChanged(`~${query}`, (results: any) => {
                    callbackCount++;

                    if (!results || !results.groups) {
                        resolve([]);
                        return;
                    }

                    // Flatten all items from all groups (myChannels + moreChannels)
                    const allItems: Channel[] = results.groups.flatMap((group: any) => {
                        // Filter out loading placeholders
                        return (group.items || []).filter((item: any) => !item.loading);
                    });

                    // Check if moreChannels group has actual items (not just loading placeholder)
                    const moreChannelsGroup = results.groups.find((g: any) => g.key === 'moreChannels');
                    const hasMoreChannelsWithItems = moreChannelsGroup &&
                        moreChannelsGroup.items &&
                        moreChannelsGroup.items.length > 0 &&
                        !moreChannelsGroup.items[0].loading;

                    const isFirstCallback = callbackCount === 1;

                    // Clear any pending timeout
                    if (pendingTimeout) {
                        clearTimeout(pendingTimeout);
                        pendingTimeout = null;
                    }

                    // If this is the first callback and moreChannels is still loading, wait for second callback
                    if (isFirstCallback && !hasMoreChannelsWithItems && allItems.length === 0) {
                        pendingTimeout = setTimeout(() => {
                            resolve(allItems);
                        }, 150);
                        return;
                    }

                    // This is either the second callback or has moreChannels with actual items (final result)
                    resolve(allItems);
                });
            });
        },

        render: () => {
            let component: ReactRenderer<typeof ChannelMentionSuggestionList> | null = null;
            let popup: HTMLElement | null = null;
            let clickOutsideHandler: ((event: MouseEvent) => void) | null = null;
            let currentItems: Channel[] = [];
            let currentSelectedIndex = 0;
            let commandFunction: ((attrs: any) => void) | null = null;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            let savedEditor: Editor | null = null;
            let startTime = 0;
            const MIN_DISPLAY_TIME = 100;

            const scrollSelectedIntoView = (index: number) => {
                setTimeout(() => {
                    const item = currentItems[index];
                    if (item && popup) {
                        const selectedElement = document.getElementById(`tiptap-channel-mention-${item.name}-${index}`);
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
                    startTime = Date.now();

                    const {items, command, clientRect, editor} = mentionProps;
                    savedEditor = editor;

                    currentItems = items || [];
                    currentSelectedIndex = 0;
                    commandFunction = command;

                    popup = document.createElement('div');
                    popup.className = 'tiptap-mention-popup tiptap-channel-mention-popup';
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

                    const ChannelListComponent = ChannelMentionSuggestionList as any;

                    // Get locale and messages from Redux store for IntlProvider
                    const state = store.getState();
                    const locale = getCurrentLocale(state);
                    const messages = getTranslations(state, locale);

                    const renderComponent = (componentItems: Channel[], selectedIdx: number) => {
                        if (popup) {
                            ReactDOM.render(
                                <Provider store={store}>
                                    <IntlProvider
                                        locale={locale}
                                        messages={messages}
                                    >
                                        <ChannelListComponent
                                            items={componentItems}
                                            selectedIndex={selectedIdx}
                                            selectItem={(index: number) => {
                                                const item = componentItems[index];
                                                if (commandFunction) {
                                                    commandFunction({
                                                        id: item.id,
                                                        label: item.name,
                                                        'data-channel-id': item.id,
                                                    });
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
                        // Return false to let TipTap handle Escape and properly exit suggestion mode.
                        // TipTap will call onExit which closes the popup.
                        // Returning true here would prevent TipTap from exiting suggestion state,
                        // breaking subsequent ~ triggers.
                        return false;
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
                            const commandData = {
                                id: item.id,
                                label: item.name,
                                'data-channel-id': item.id,
                            };
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
