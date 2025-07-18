// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import type {ChangeEvent, ElementType, FocusEvent, KeyboardEvent, MouseEvent} from 'react';
import {FormattedMessage} from 'react-intl';

import type {Channel} from '@mattermost/types/channels';
import type {Group} from '@mattermost/types/groups';
import type {UserProfile} from '@mattermost/types/users';

import {Preferences} from 'mattermost-redux/constants';
import type {ActionResult} from 'mattermost-redux/types/actions';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

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

import type {MentionKey} from 'utils/text_formatting';
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
    hasError?: boolean;
    isInEditMode?: boolean;
    usersByUsername?: Record<string, UserProfile>;
    teammateNameDisplay?: string;
    mentionKeys?: MentionKey[];
};

const VISIBLE = {visibility: 'visible'};
const HIDDEN = {visibility: 'hidden'};

export default class Textbox extends React.PureComponent<Props> {
    private readonly suggestionProviders: Provider[];
    private readonly wrapper: React.RefObject<HTMLDivElement>;
    private readonly message: React.RefObject<SuggestionBoxComponent>;
    private readonly preview: React.RefObject<HTMLDivElement>;
    private readonly textareaRef: React.RefObject<HTMLTextAreaElement>;

    state = {
        displayValue: '', // UI表示用の値（username→fullname変換済み）
        rawValue: '', // サーバー送信用の値（username形式のまま）
    };

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
        this.textareaRef = React.createRef();

        // state初期化 - propsのvalueからdisplayValueとrawValueを設定
        this.state = {
            displayValue: this.convertToDisplayName(props.value),
            rawValue: props.value,
        };
    }

    /**
     * username (@user) をフルネーム/ニックネーム (@Full Name) に変換
     */
    convertToDisplayName = (text: string): string => {
        const {usersByUsername = {}, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME} = this.props;

        return text.replace(/@([a-zA-Z0-9.\-_]+)/g, (match, username) => {
            const user = usersByUsername[username];
            if (user) {
                const displayName = displayUsername(user, teammateNameDisplay, false);
                return `@${displayName}`;
            }
            return match;
        });
    };

    /**
     * フルネーム/ニックネーム (@Full Name) をusername (@user) に変換
     */
    convertToRawValue = (text: string): string => {
        const {usersByUsername = {}, teammateNameDisplay = Preferences.DISPLAY_PREFER_USERNAME} = this.props;

        // usersByUsernameを逆引き用のマップに変換
        const displayNameToUsername: Record<string, string> = {};
        Object.entries(usersByUsername).forEach(([username, user]) => {
            const displayName = displayUsername(user, teammateNameDisplay, false);

            if (displayName && displayName !== username) {
                displayNameToUsername[displayName] = username;
            }
        });

        const sortedDisplayNames = Object.keys(displayNameToUsername).sort((a, b) => b.length - a.length);

        let result = text;
        for (const displayName of sortedDisplayNames) {
            const escapedDisplayName = displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`@${escapedDisplayName}(?=\\s|$|[^\\w])`, 'g');

            result = result.replace(regex, () => {
                const username = displayNameToUsername[displayName];
                return `@${username}`;
            });
        }

        return result;
    };

    /**
     * サーバー送信用の生の値（username形式）を取得
     */
    getRawValue = () => {
        return this.state.rawValue;
    };

    /**
     * サーバー送信用の生の値（username形式）を取得
     */
    getValue = () => {
        return this.state.rawValue;
    };

    /**
     * UI表示用の値（fullname形式）を取得
     */
    getDisplayValue = () => {
        return this.state.displayValue;
    };

    handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // 生の値（username形式）を更新
        const newRawValue = this.convertToRawValue(inputValue);

        // 表示用の値（fullname形式）を更新
        const newDisplayValue = this.convertToDisplayName(newRawValue);

        this.setState({
            rawValue: newRawValue,
            displayValue: newDisplayValue,
        });

        // 親コンポーネントには生の値（username形式）を渡す
        const syntheticEvent = {
            ...e,
            target: {
                ...e.target,
                value: newRawValue,
            },
        } as React.ChangeEvent<HTMLInputElement>;

        this.props.onChange(syntheticEvent);
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

            // props.valueが変更された場合、stateを更新
            this.setState({
                rawValue: this.props.value,
                displayValue: this.convertToDisplayName(this.props.value),
            });
        }

        // usersByUsernameまたはteammateNameDisplayが変更された場合、displayValueを再計算
        if (prevProps.usersByUsername !== this.props.usersByUsername ||
            prevProps.teammateNameDisplay !== this.props.teammateNameDisplay) {
            this.setState({
                displayValue: this.convertToDisplayName(this.state.rawValue),
            });
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
        const textbox = this.message.current?.getTextbox();
        if (textbox && this.textareaRef.current !== textbox) {
            // textareaRefを更新
            (this.textareaRef as any).current = textbox;
        }
        return textbox;
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

        if (this.props.hasError) {
            textboxClassName += ' textarea--has-errors';
        }

        return (
            <div
                ref={this.wrapper}
                className={classNames('textarea-wrapper', {'textarea-wrapper-preview': this.props.preview, 'textarea-wrapper-preview--disabled': Boolean(this.props.preview && this.props.disabled)})}
            >
                <div
                    tabIndex={this.props.tabIndex}
                    ref={this.preview}
                    className={classNames('form-control custom-textarea textbox-preview-area', {'textarea--has-labels': this.props.hasLabels})}
                    onKeyPress={this.props.onKeyPress}
                    onKeyDown={this.handleKeyDown}
                    onBlur={this.handleBlur}
                >
                    <PostMarkdown
                        message={this.state.displayValue}
                        channelId={this.props.channelId}
                        options={{
                            mentionHighlight: true,
                            atMentions: true,
                            mentionKeys: this.props.mentionKeys,
                        }}
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
                    value={this.state.displayValue}
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
