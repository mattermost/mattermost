// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import type {SuggestionOptions} from '@tiptap/suggestion';
import React from 'react';
import ReactDOM from 'react-dom';

import {filterFormattingActions, type FormattingAction} from './formatting_actions';
import SlashCommandMenu from './slash_command_menu';
import type {SlashCommandMenuRef} from './slash_command_menu';

// Global state for slash command menu to prevent conflicts between multiple editor instances
let globalExitTimeout: ReturnType<typeof setTimeout> | null = null;
let globalIsRendering = false;
let globalLastValidRange: {from: number; to: number} | null = null;

export const SlashCommandExtension = Extension.create<{
    onOpenLinkModal: () => void;
    onOpenImageModal: () => void;
    suggestion: Partial<SuggestionOptions>;
}>({
    name: 'slashCommand',

    addOptions() {
        const self = this;
        return {
            onOpenLinkModal: () => {},
            onOpenImageModal: () => {},
            suggestion: {
                char: '/',
                allowSpaces: false,
                allowedPrefixes: null,
                startOfLine: false,
                items: ({query}: {query: string}): FormattingAction[] => {
                    return filterFormattingActions(query);
                },
                render: () => {
                    // Use a global popup to prevent multiple instances
                    const POPUP_ID = 'tiptap-slash-command-popup-singleton';
                    let popup: HTMLElement | null = null;
                    let componentRef: SlashCommandMenuRef | null = null;
                    let currentItems: FormattingAction[] = [];
                    let commandFunction: ((item: FormattingAction) => void) | null = null;

                    const closePopup = () => {
                        const existingPopup = document.getElementById(POPUP_ID);
                        if (existingPopup && existingPopup.parentNode) {
                            ReactDOM.unmountComponentAtNode(existingPopup);
                            existingPopup.parentNode.removeChild(existingPopup);
                        }
                        popup = null;
                        componentRef = null;
                    };

                    const renderComponent = (items: FormattingAction[]) => {
                        if (popup && commandFunction) {
                            ReactDOM.render(
                                <SlashCommandMenu
                                    ref={(ref) => {
                                        componentRef = ref;
                                    }}
                                    items={items}
                                    command={(item: FormattingAction) => {
                                        if (commandFunction) {
                                            commandFunction(item);
                                        }
                                        closePopup();
                                    }}
                                />,
                                popup,
                            );
                        }
                    };

                    return {
                        onStart: (props: any) => {
                            const {items, command, clientRect, range} = props;
                            currentItems = items || [];
                            commandFunction = command;
                            globalIsRendering = true;

                            // Store the range globally for later use
                            globalLastValidRange = range;

                            // Clear any pending exit timeout
                            if (globalExitTimeout) {
                                clearTimeout(globalExitTimeout);
                                globalExitTimeout = null;
                            }

                            // Clear any existing popup first
                            closePopup();

                            popup = document.createElement('div');
                            popup.id = POPUP_ID;
                            popup.className = 'tiptap-slash-command-popup';
                            document.body.appendChild(popup);

                            if (clientRect) {
                                const rect = clientRect();
                                if (rect) {
                                    popup.style.position = 'absolute';
                                    popup.style.top = `${rect.bottom + window.scrollY}px`;
                                    popup.style.left = `${rect.left + window.scrollX}px`;
                                    popup.style.zIndex = '1000';
                                }
                            }

                            renderComponent(items);
                            globalIsRendering = false;
                        },

                        onUpdate: (props: any) => {
                            const {items, clientRect, range} = props;
                            currentItems = items || [];

                            // Update the global range as the user types
                            globalLastValidRange = range;

                            // Cancel any pending exit since we're updating
                            if (globalExitTimeout) {
                                clearTimeout(globalExitTimeout);
                                globalExitTimeout = null;
                            }

                            if (popup && clientRect) {
                                const rect = clientRect();
                                if (rect) {
                                    popup.style.top = `${rect.bottom + window.scrollY}px`;
                                    popup.style.left = `${rect.left + window.scrollX}px`;
                                }
                            }

                            renderComponent(currentItems);
                        },

                        onKeyDown: (props: any) => {
                            if (props.event.key === 'Escape') {
                                closePopup();
                                return true;
                            }

                            if (!componentRef) {
                                return false;
                            }

                            return componentRef.onKeyDown(props.event);
                        },

                        onExit: () => {
                            if (globalIsRendering) {
                                return;
                            }
                            // Don't close the menu immediately - keep it open for user selection
                            // We'll manually track the range so it's still valid when they select
                        },
                    };
                },
                command: ({editor, range, props}: {editor: any; range: any; props: FormattingAction}) => {
                    // Use our manually tracked range instead of TipTap's stale range
                    const rangeToUse = globalLastValidRange || range;

                    editor.chain().focus().deleteRange(rangeToUse).run();

                    // Clear the global range after use
                    globalLastValidRange = null;

                    if (props.requiresModal && props.modalType === 'link') {
                        self.options.onOpenLinkModal();
                        return;
                    }

                    if (props.requiresModal && props.modalType === 'image') {
                        self.options.onOpenImageModal();
                        return;
                    }

                    props.command(editor);
                },
            } as Partial<SuggestionOptions>,
        };
    },

    addProseMirrorPlugins() {
        return [
            Suggestion({
                editor: this.editor,
                ...(this.options.suggestion || {}),
            }),
        ];
    },
});
