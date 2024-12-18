// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ChangeEvent, ElementType, FocusEvent, KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import type {ActionResult} from 'mattermost-redux/types/actions';

import AutosizeTextarea from 'components/autosize_textarea';
import PostMarkdown from 'components/post_markdown';
import AtMentionProvider from 'components/suggestion/at_mention_provider';
import ChannelMentionProvider from 'components/suggestion/channel_mention_provider';
import AppCommandProvider from 'components/suggestion/command_provider/app_provider';
import CommandProvider from 'components/suggestion/command_provider/command_provider';
import EmoticonProvider from 'components/suggestion/emoticon_provider';
import type Provider from 'components/suggestion/provider';
import SuggestionBox from 'components/suggestion/suggestion_box';
import type SuggestionBoxComponent from 'components/suggestion/suggestion_box/suggestion_box';
import SuggestionList from 'components/suggestion/suggestion_list';

import * as Utils from 'utils/utils';

import type {TextboxElement} from './index';

const ALL = ['all'];

export type Props = {
    id: string;
    channelId: string;
    rootId?: string;
    tabIndex?: number;
    value: string;
    onChange: (e: ChangeEvent<TextboxElement>) => void;
    onKeyPress: (e: KeyboardEvent<any>) => void;
    onComposition?: () => void;
    onHeightChange?: (height: number, maxHeight: number) => void;
    onWidthChange?: (width: number) => void;
    createMessage: string;
    onKeyDown?: (e: KeyboardEvent<TextboxElement>) => void;
    onMouseUp?: (e: React.MouseEvent<TextboxElement>) => void;
    onKeyUp?: (e: React.KeyboardEvent<TextboxElement>) => void;
    onBlur?: (e: FocusEvent<TextboxElement>) => void;
    onFocus?: (e: FocusEvent<TextboxElement>) => void;
    supportsCommands?: boolean;
    handlePostError?: (message: JSX.Element | null) => void;
    onPaste?: (e: ClipboardEvent) => void;
    suggestionList?: React.ComponentProps<typeof SuggestionBox>['listComponent'];
    suggestionListPosition?: React.ComponentProps<typeof SuggestionList>['position'];
    alignWithTextbox?: boolean;
    emojiEnabled?: boolean;
    characterLimit: number;
    disabled?: boolean;
    badConnection?: boolean;
    currentUserId: string;
    currentTeamId: string;
    preview?: boolean;
    autocompleteGroups: Group[] | null;
    delayChannelAutocomplete: boolean;
    actions: {
        autocompleteUsersInChannel: (prefix: string, channelId: string) => Promise<ActionResult>;
        autocompleteChannels: (term: string, success: (channels: Channel[]) => void, error: () => void) => Promise<ActionResult>;
        searchAssociatedGroupsForReference: (prefix: string, teamId: string, channelId: string | undefined) => Promise<{ data: any }>;
    };
    useChannelMentions: boolean;
    inputComponent?: ElementType;
    openWhenEmpty?: boolean;
    priorityProfiles?: UserProfile[];
    hasLabels?: boolean;
    isInEditMode?: boolean;
};

const VISIBLE = {visibility: 'visible'};
const HIDDEN = {visibility: 'hidden'};

export default class Textbox extends React.PureComponent<Props> {
    private readonly suggestionProviders: Provider[];
    private readonly wrapper: React.RefObject<HTMLDivElement>;
    private readonly message: React.RefObject<SuggestionBoxComponent>;
    private readonly preview: React.RefObject<HTMLDivElement>;

    static defaultProps = {
        supportsCommands: true,
        inputComponent: AutosizeTextarea,
        suggestionList: SuggestionList,
    };

    constructor(props: Props) {
        super(props);

        this.suggestionProviders = [];

        if (props.supportsCommands) {
            this.suggestionProviders.push(new AppCommandProvider({
                teamId: this.props.currentTeamId,
                channelId: this.props.channelId,
                rootId: this.props.rootId,
            }));
        }

        this.suggestionProviders.push(
            new AtMentionProvider({
                currentUserId: this.props.currentUserId,
                channelId: this.props.channelId,
                autocompleteUsersInChannel: (prefix: string) => this.props.actions.autocompleteUsersInChannel(prefix, this.props.channelId),
                useChannelMentions: this.props.useChannelMentions,
                autocompleteGroups: this.props.autocompleteGroups,
                searchAssociatedGroupsForReference: (prefix: string) => this.props.actions.searchAssociatedGroupsForReference(prefix, this.props.currentTeamId, this.props.channelId),
                priorityProfiles: this.props.priorityProfiles,
            }),
            new ChannelMentionProvider(props.actions.autocompleteChannels, props.delayChannelAutocomplete),
            new EmoticonProvider(),
        );

        if (props.supportsCommands) {
            this.suggestionProviders.push(new CommandProvider({
                teamId: this.props.currentTeamId,
                channelId: this.props.channelId,
                rootId: this.props.rootId,
            }));
        }

        this.checkMessageLength(props.value);
        this.wrapper = React.createRef();
        this.message = React.createRef();
        this.preview = React.createRef();
    }

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.props.onChange(e);
    };

    updateSuggestions(prevProps: Props) {
        if (this.props.channelId !== prevProps.channelId ||
            this.props.currentUserId !== prevProps.currentUserId ||
            this.props.autocompleteGroups !== prevProps.autocompleteGroups ||
            this.props.useChannelMentions !== prevProps.useChannelMentions ||
            this.props.currentTeamId !== prevProps.currentTeamId ||
            this.props.priorityProfiles !== prevProps.priorityProfiles) {
            // Update channel id for AtMentionProvider.
            for (const provider of this.suggestionProviders) {
                if (provider instanceof AtMentionProvider) {
                    provider.setProps({
                        currentUserId: this.props.currentUserId,
                        channelId: this.props.channelId,
                        autocompleteUsersInChannel: (prefix: string) => this.props.actions.autocompleteUsersInChannel(prefix, this.props.channelId),
                        useChannelMentions: this.props.useChannelMentions,
                        autocompleteGroups: this.props.autocompleteGroups,
                        searchAssociatedGroupsForReference: (prefix: string) => this.props.actions.searchAssociatedGroupsForReference(prefix, this.props.currentTeamId, this.props.channelId),
                        priorityProfiles: this.props.priorityProfiles,
                    });
                }
            }
        }

        if (this.props.channelId !== prevProps.channelId ||
            this.props.currentTeamId !== prevProps.currentTeamId ||
            this.props.rootId !== prevProps.rootId) {
            // Update channel id for CommandProvider and AppCommandProvider.
            for (const provider of this.suggestionProviders) {
                if (provider instanceof CommandProvider) {
                    provider.setProps({
                        teamId: this.props.currentTeamId,
                        channelId: this.props.channelId,
                        rootId: this.props.rootId,
                    });
                }
                if (provider instanceof AppCommandProvider) {
                    provider.setProps({
                        teamId: this.props.currentTeamId,
                        channelId: this.props.channelId,
                        rootId: this.props.rootId,
                    });
                }
            }
        }

        if (this.props.delayChannelAutocomplete !== prevProps.delayChannelAutocomplete) {
            for (const provider of this.suggestionProviders) {
                if (provider instanceof ChannelMentionProvider) {
                    provider.setProps({
                        delayChannelAutocomplete: this.props.delayChannelAutocomplete,
                    });
                }
            }
        }

        if (prevProps.value !== this.props.value) {
            this.checkMessageLength(this.props.value);
        }
    }

    componentDidUpdate(prevProps: Props) {
        if (!prevProps.preview && this.props.preview) {
            this.preview.current?.focus();
        }

        this.updateSuggestions(prevProps);
    }

    checkMessageLength = (message: string) => {
        if (this.props.handlePostError) {
            if (message.length > this.props.characterLimit) {
                const errorMessage = (
                    <FormattedMessage
                        id='create_post.error_message'
                        defaultMessage='Your message is too long. Character count: {length}/{limit}'
                        values={{
                            length: message.length,
                            limit: this.props.characterLimit,
                        }}
                    />);
                this.props.handlePostError(errorMessage);
            } else {
                this.props.handlePostError(null);
            }
        }
    };

    // adding in the HTMLDivElement to support event handling in preview state
    handleKeyDown = (e: KeyboardEvent<TextboxElement | HTMLDivElement>) => {
        // since we do only handle the sending when in preview mode this is fine to be casted
        this.props.onKeyDown?.(e as KeyboardEvent<TextboxElement>);
    };

    handleMouseUp = (e: MouseEvent<TextboxElement>) => this.props.onMouseUp?.(e);

    handleKeyUp = (e: KeyboardEvent<TextboxElement>) => this.props.onKeyUp?.(e);

    // adding in the HTMLDivElement to support event handling in preview state
    handleBlur = (e: FocusEvent<TextboxElement | HTMLDivElement>) => {
        // since we do only handle the sending when in preview mode this is fine to be casted
        this.props.onBlur?.(e as FocusEvent<TextboxElement>);
    };

    getInputBox = () => {
        return this.message.current?.getTextbox();
    };

    focus = () => {
        const textbox = this.getInputBox();
        if (textbox) {
            textbox.focus();
            Utils.placeCaretAtEnd(textbox);
            setTimeout(() => {
                Utils.scrollToCaret(textbox);
            });

            // reset character count warning
            this.checkMessageLength(textbox.value);
        }
    };

    blur = () => {
        this.getInputBox()?.blur();
    };

    getStyle = () => {
        return this.props.preview ? HIDDEN : VISIBLE;
    };

    render() {
        let textboxClassName = 'form-control custom-textarea textbox-edit-area';
        if (this.props.emojiEnabled) {
            textboxClassName += ' custom-textarea--emoji-picker';
        }
        if (this.props.badConnection) {
            textboxClassName += ' bad-connection';
        }
        if (this.props.hasLabels) {
            textboxClassName += ' textarea--has-labels';
        }

        return (
            <div
                ref={this.wrapper}
                className={classNames('textarea-wrapper', {'textarea-wrapper-preview': this.props.preview})}
            >
                <div
                    tabIndex={this.props.tabIndex || 0}
                    ref={this.preview}
                    className={classNames('form-control custom-textarea textbox-preview-area', {'textarea--has-labels': this.props.hasLabels})}
                    onKeyPress={this.props.onKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onBlur={this.handleBlur}
                >
                    <PostMarkdown
                        message={this.props.value}
                        channelId={this.props.channelId}
                        imageProps={{hideUtilities: true}}
                    />
                </div>
                <SuggestionBox
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    ref={this.message}
                    id={this.props.id}
                    className={textboxClassName}
                    spellCheck='true'
                    placeholder={this.props.createMessage}
                    onChange={this.handleChange}
                    onKeyPress={this.props.onKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onMouseUp={this.handleMouseUp}
                    onKeyUp={this.handleKeyUp}
                    onComposition={this.props.onComposition}
                    onBlur={this.handleBlur}
                    onFocus={this.props.onFocus}
                    onHeightChange={this.props.onHeightChange}
                    onWidthChange={this.props.onWidthChange}
                    onPaste={this.props.onPaste}
                    style={this.getStyle()}
                    inputComponent={this.props.inputComponent}
                    listComponent={this.props.suggestionList}
                    listPosition={this.props.suggestionListPosition}
                    providers={this.suggestionProviders}
                    value={this.props.value}
                    renderDividers={ALL}
                    disabled={this.props.disabled}
                    contextId={this.props.channelId}
                    openWhenEmpty={this.props.openWhenEmpty}
                    alignWithTextbox={this.props.alignWithTextbox}
                />
            </div>
        );
    }
}
