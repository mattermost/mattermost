// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ComponentProps} from 'react';
import React, {useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import styled from 'styled-components';

import {ChevronDownIcon} from '@mattermost/compass-icons/components';
import type {ChannelBookmark} from '@mattermost/types/channel_bookmarks';
import type {Emoji} from '@mattermost/types/emojis';
import type {FileInfo} from '@mattermost/types/files';

import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import Input from 'components/widgets/inputs/input/input';

import BookmarkIcon from './bookmark_icon';

type Props = {
    type: ChannelBookmark['type'];
    fileInfo: FileInfo | undefined;
    imageUrl: string | undefined;
    emoji: string | undefined;
    setEmoji: React.Dispatch<React.SetStateAction<string | undefined>>;
    placeholder: string | undefined;
    displayName: string | undefined;
    setDisplayName: React.Dispatch<React.SetStateAction<string | undefined>>;
}
const CreateModalNameInput = ({
    type,
    imageUrl,
    fileInfo,
    emoji,
    setEmoji,
    placeholder,
    displayName,
    setDisplayName,
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

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);

    const handleEmojiClick = (selectedEmoji: Emoji) => {
        setShowEmojiPicker(false);
        const emojiName = ('short_name' in selectedEmoji) ? selectedEmoji.short_name : selectedEmoji.name;
        setEmoji(`:${emojiName}:`);
    };

    const handleEmojiClear = () => {
        setEmoji(undefined);
    };

    const handleEmojiClose = () => {
        setShowEmojiPicker(false);
    };

    const handleInputChange: ComponentProps<typeof Input>['onChange'] = (e) => {
        setDisplayName(e.currentTarget.value);
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
                    />
                )}
                <button
                    ref={targetRef}
                    type='button'
                    onClick={toggleEmojiPicker}
                    aria-label={formatMessage({id: 'emoji_picker.emojiPicker.button.ariaLabel', defaultMessage: 'select an emoji'})}
                    aria-expanded={showEmojiPicker ? 'true' : 'false'}
                    className='channelBookmarksMenuButton emoji-picker__container BookmarkCreateModal__emoji-button'
                >
                    {icon}
                    <ChevronDownIcon size={'12px'}/>
                </button>
                <Input
                    type='text'
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
