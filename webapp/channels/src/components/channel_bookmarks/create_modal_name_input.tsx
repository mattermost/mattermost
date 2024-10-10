// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useCallback, useRef} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Emoji} from '@mattermost/types/emojis';
import type {FileInfo} from '@mattermost/types/files';

import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import Input from 'components/widgets/inputs/input/input';

import Constants, {A11yCustomEventTypes, type A11yFocusEventDetail} from 'utils/constants';
import {isKeyPressed} from 'utils/keyboard';

import BookmarkIcon from './bookmark_icon';

type Props = {
    maxLength: number;
    type: ChannelBookmark['type'];
    fileInfo: FileInfo | undefined;
    imageUrl: string | undefined;
    emoji: string | undefined;
    setEmoji: React.Dispatch<React.SetStateAction<string>>;
    placeholder: string | undefined;
    displayName: string | undefined;
    setDisplayName: React.Dispatch<React.SetStateAction<string | undefined>>;
    showEmojiPicker: boolean;
    setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
    onAddCustomEmojiClick?: () => void;
}
const CreateModalNameInput = ({
    maxLength,
    type,
    imageUrl,
    fileInfo,
    emoji,
    setEmoji,
    placeholder,
    displayName,
    setDisplayName,
    showEmojiPicker,
    setShowEmojiPicker,
    onAddCustomEmojiClick,
}: Props) => {
    const {formatMessage} = useIntl();

    const targetRef = useRef<HTMLButtonElement>(null);
    const getTargetRef = () => targetRef.current;

    const icon = (
        <BookmarkIcon
            type={type}
            size={24}
            emoji={emoji}
            fileInfo={fileInfo}
            imageUrl={imageUrl}
        />
    );

    const refocusEmojiButton = () => {
        if (!targetRef.current) {
            return;
        }

        document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
            A11yCustomEventTypes.FOCUS, {
                detail: {
                    target: targetRef.current,
                    keyboardOnly: true,
                },
            },
        ));
    };

    const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);

    const handleEmojiClick = (selectedEmoji: Emoji) => {
        setShowEmojiPicker(false);
        const emojiName = ('short_name' in selectedEmoji) ? selectedEmoji.short_name : selectedEmoji.name;
        setEmoji(`:${emojiName}:`);
        refocusEmojiButton();
    };

    const handleEmojiClear = () => {
        setEmoji('');
    };

    const handleEmojiClose = () => {
        setShowEmojiPicker(false);
        refocusEmojiButton();
    };

    const handleInputChange: ComponentProps<typeof Input>['onChange'] = useCallback((e) => {
        setDisplayName(e.currentTarget.value);
    }, []);

    const handleEmojiKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER)) {
            e.stopPropagation();
        }
    };

    const handleEmojiResetKeyDown = (e: React.KeyboardEvent<HTMLAnchorElement>) => {
        if (isKeyPressed(e, Constants.KeyCodes.ENTER) || isKeyPressed(e, Constants.KeyCodes.SPACE)) {
            e.stopPropagation();
            handleEmojiClear();
        }
    };

    return (
        <>
            <NameWrapper>
                {showEmojiPicker && (
                    <EmojiPickerOverlay
                        target={getTargetRef}
                        show={showEmojiPicker}
                        onHide={handleEmojiClose}
                        onEmojiClick={handleEmojiClick}
                        placement='right'
                        onAddCustomEmojiClick={onAddCustomEmojiClick}
                    />

                )}
                <button
                    ref={targetRef}
                    type='button'
                    onClick={toggleEmojiPicker}
                    onKeyDown={handleEmojiKeyDown}
                    aria-label={formatMessage({id: 'emoji_picker.emojiPicker.button.ariaLabel', defaultMessage: 'select an emoji'})}
                    aria-expanded={showEmojiPicker ? 'true' : 'false'}

                    className='channelBookmarksMenuButton emoji-picker__container BookmarkCreateModal__emoji-button'
                >
                    {icon}
                    <ChevronDownIcon size={'12px'}/>
                </button>
                <Input
                    maxLength={maxLength}
                    type='text'
                    name='bookmark-display-name'
                    onChange={handleInputChange}
                    value={displayName ?? placeholder ?? ''}
                    placeholder={placeholder}
                    data-testid='titleInput'
                    useLegend={false}
                />
                <Clear
                    visible={Boolean(emoji)}
                    tabIndex={0}
                    onClick={handleEmojiClear}
                    onKeyDown={handleEmojiResetKeyDown}
                >
                    <FormattedMessage
                        id='channel_bookmarks.create.title_input.clear_emoji'
                        defaultMessage='Remove emoji'
                    />
                </Clear>
            </NameWrapper>
        </>
    );
};

const Clear = styled.a<{visible: boolean}>`
    font-size: 12px;
    visibility: ${({visible}) => (visible ? 'visible' : 'hidden')};
`;

const NameWrapper = styled.div`
    position: relative;

    > button {
        position: absolute;
        left: 1px;
        top: 1px;
        z-index: 5;
        width: 57px;
        height: 44px;
        border-radius: 4px 0 0 4px;
        border-right: 1px solid rgba(var(--center-channel-color-rgb), 0.16);

        align-items: center;
        justify-content: center;
        gap: 0;
        padding-left: 6px;
        padding-right: 2px;

        svg {
            flex-shrink: 0;
        }
    }

    .Input_container {

    }

    .Input_wrapper {
        padding-left: 7rem;
    }
`;

export default CreateModalNameInput;
