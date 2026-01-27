// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {SuggestionOptions, SuggestionProps, SuggestionKeyDownProps} from '@tiptap/suggestion';
import React from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import {getCurrentLocale, getTranslations} from 'selectors/i18n';
import store from 'stores/redux_store';

export type SuggestionRendererConfig<T> = {

    // CSS class for popup container
    popupClassName: string;

    // Generate unique ID for item (for scrollIntoView)
    getItemId: (item: T, index: number) => string;

    // React component to render the list
    ListComponent: React.ComponentType<{
        items: T[];
        selectedIndex: number;
        selectItem: (index: number) => void;
    }>;

    // Transform item to command attrs
    getCommandAttrs: (item: T) => Record<string, unknown>;

    // Optional: ARIA label for dialog
    ariaLabel?: string;

    // Optional: Called when popup exits (e.g., to reset provider state)
    onPopupExit?: () => void;
};

export function createSuggestionRenderer<T>(
    config: SuggestionRendererConfig<T>,
): Pick<SuggestionOptions<T>, 'render'> {
    return {
        render: () => {
            let popup: HTMLElement | null = null;
            let root: Root | null = null;
            let clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
            let currentItems: T[] = [];
            let currentSelectedIndex = 0;
            let commandFunction: ((attrs: Record<string, unknown>) => void) | null = null;

            // Cache locale/messages once
            let locale: string;
            let messages: Record<string, string>;

            const scrollSelectedIntoView = (index: number) => {
                setTimeout(() => {
                    const item = currentItems[index];
                    if (item && popup) {
                        const el = document.getElementById(config.getItemId(item, index));
                        el?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
                    }
                }, 0);
            };

            const closePopup = () => {
                try {
                    if (clickOutsideHandler) {
                        document.removeEventListener('mousedown', clickOutsideHandler, true);
                        clickOutsideHandler = null;
                    }
                    if (root) {
                        root.unmount();
                        root = null;
                    }
                    if (popup?.parentNode) {
                        popup.parentNode.removeChild(popup);
                    }
                } finally {
                    popup = null;
                }
            };

            const renderComponent = (items: T[], selectedIdx: number) => {
                if (!popup) {
                    return;
                }
                if (!root) {
                    root = createRoot(popup);
                }
                const {ListComponent} = config;
                root.render(
                    <Provider store={store}>
                        <IntlProvider
                            locale={locale}
                            messages={messages}
                        >
                            <ListComponent
                                items={items}
                                selectedIndex={selectedIdx}
                                selectItem={(index) => {
                                    const item = items[index];
                                    if (commandFunction && item) {
                                        commandFunction(config.getCommandAttrs(item));
                                    }
                                    closePopup();
                                }}
                            />
                        </IntlProvider>
                    </Provider>,
                );
            };

            const updatePosition = (clientRect: (() => DOMRect | null) | null | undefined) => {
                if (!popup || !clientRect) {
                    return;
                }
                try {
                    const rect = clientRect();
                    if (rect) {
                        popup.style.top = `${rect.bottom + window.scrollY}px`;
                        popup.style.left = `${rect.left + window.scrollX}px`;
                    }
                } catch {
                    // Ignore positioning errors
                }
            };

            return {
                onStart: (props: SuggestionProps<T>) => {
                    const state = store.getState();
                    locale = getCurrentLocale(state);
                    messages = getTranslations(state, locale);

                    currentItems = props.items || [];
                    currentSelectedIndex = 0;
                    commandFunction = props.command;

                    popup = document.createElement('div');
                    popup.className = config.popupClassName;
                    if (config.ariaLabel) {
                        popup.setAttribute('role', 'dialog');
                        popup.setAttribute('aria-label', config.ariaLabel);
                    }
                    document.body.appendChild(popup);

                    clickOutsideHandler = (e) => {
                        if (popup && !popup.contains(e.target as Node)) {
                            closePopup();
                        }
                    };
                    document.addEventListener('mousedown', clickOutsideHandler, true);

                    updatePosition(props.clientRect);
                    renderComponent(currentItems, 0);
                },

                onUpdate: (props: SuggestionProps<T>) => {
                    if (props.items) {
                        currentItems = props.items;
                    }
                    if (props.command) {
                        commandFunction = props.command;
                    }
                    renderComponent(currentItems, currentSelectedIndex);
                    updatePosition(props.clientRect);
                },

                onKeyDown: (props: SuggestionKeyDownProps) => {
                    const {event} = props;
                    if (!event?.key) {
                        return false;
                    }

                    if (event.key === 'Escape') {
                        return false;
                    }
                    if (currentItems.length === 0) {
                        return false;
                    }

                    if (event.key === 'ArrowUp') {
                        currentSelectedIndex = currentSelectedIndex > 0 ? currentSelectedIndex - 1 : currentItems.length - 1;
                        renderComponent(currentItems, currentSelectedIndex);
                        scrollSelectedIntoView(currentSelectedIndex);
                        return true;
                    }

                    if (event.key === 'ArrowDown') {
                        currentSelectedIndex = currentSelectedIndex < currentItems.length - 1 ? currentSelectedIndex + 1 : 0;
                        renderComponent(currentItems, currentSelectedIndex);
                        scrollSelectedIntoView(currentSelectedIndex);
                        return true;
                    }

                    if (event.key === 'Enter' || event.key === 'Tab') {
                        const item = currentItems[currentSelectedIndex];
                        if (item && commandFunction) {
                            commandFunction(config.getCommandAttrs(item));
                            closePopup();
                            return true;
                        }
                    }

                    return false;
                },

                onExit: () => {
                    closePopup();
                    config.onPopupExit?.();
                },
            };
        },
    };
}
