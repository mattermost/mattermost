// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useRef, useState} from 'react';
import {Tab, Tabs} from 'react-bootstrap';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import {makeAsyncComponent} from 'components/async_load';
import EmojiPicker from 'components/emoji_picker';
import EmojiPickerHeader from 'components/emoji_picker/components/emoji_picker_header';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import GifIcon from 'components/widgets/icons/giphy_icon';

const GifPicker = makeAsyncComponent('GifPicker', React.lazy(() => import('components/gif_picker/gif_picker')));

export interface Props {
    onEmojiClose: () => void;
    onEmojiClick: (emoji: Emoji) => void;
    onGifClick?: (gif: string) => void;
    onAddCustomEmojiClick?: () => void;
    enableGifPicker?: boolean;
}

export default function EmojiPickerTabs(props: Props) {
    const intl = useIntl();

    const [activeKey, setActiveKey] = useState(1);
    const [filter, setFilter] = useState('');

    const rootPickerNodeRef = useRef<HTMLDivElement>(null);
    const getRootPickerNode = useCallback(() => rootPickerNodeRef.current, []);

    if (props.enableGifPicker && typeof props.onGifClick != 'undefined') {
        return (
            <div
                id='emojiGifPicker'
                ref={rootPickerNodeRef}
                className='a11y__popup emoji-picker'
                role='dialog'
                aria-label={activeKey === 1 ? intl.formatMessage({id: 'emoji_gif_picker.dialog.emojis', defaultMessage: 'Emoji Picker'}) : intl.formatMessage({id: 'emoji_gif_picker.dialog.gifs', defaultMessage: 'GIF Picker'})}
                aria-modal='true'
            >
                <EmojiPickerHeader handleEmojiPickerClose={props.onEmojiClose}/>
                <Tabs
                    id='emoji-picker-tabs'
                    defaultActiveKey={1}
                    justified={true}
                    mountOnEnter={true}
                    unmountOnExit={true}
                    activeKey={activeKey}
                    onSelect={(activeKey) => setActiveKey(activeKey)}
                >
                    <Tab
                        eventKey={1}
                        title={
                            <div className={'custom-emoji-tab__icon__text'}>
                                <EmojiIcon
                                    className='custom-emoji-tab__icon'
                                    aria-hidden={true}
                                />
                                <FormattedMessage
                                    id='emoji_gif_picker.tabs.emojis'
                                    defaultMessage='Emojis'
                                />
                            </div>
                        }
                        unmountOnExit={true}
                        tabClassName={'custom-emoji-tab'}
                    >
                        <EmojiPicker
                            filter={filter}
                            onEmojiClick={props.onEmojiClick}
                            handleFilterChange={setFilter}
                            handleEmojiPickerClose={props.onEmojiClose}
                        />
                    </Tab>
                    <Tab
                        eventKey={2}
                        title={
                            <div className={'custom-emoji-tab__icon__text'}>
                                <GifIcon
                                    className='custom-emoji-tab__icon'
                                    aria-hidden={true}
                                />
                                <FormattedMessage
                                    id='emoji_gif_picker.tabs.gifs'
                                    defaultMessage='GIFs'
                                />
                            </div>
                        }
                        unmountOnExit={true}
                        tabClassName={'custom-emoji-tab'}
                    >
                        <GifPicker
                            filter={filter}
                            getRootPickerNode={getRootPickerNode}
                            onGifClick={props.onGifClick}
                            handleFilterChange={setFilter}
                        />
                    </Tab>
                </Tabs>
            </div>
        );
    }

    return (
        <div
            id='emojiPicker'
            className='a11y__popup emoji-picker emoji-picker--single'
            role='dialog'
            aria-label={intl.formatMessage({id: 'emoji_gif_picker.dialog.emojis', defaultMessage: 'Emoji Picker'})}
            aria-modal='true'
        >
            <EmojiPickerHeader handleEmojiPickerClose={props.onEmojiClose}/>
            <EmojiPicker
                filter={filter}
                onEmojiClick={props.onEmojiClick}
                handleFilterChange={setFilter}
                handleEmojiPickerClose={props.onEmojiClose}
                onAddCustomEmojiClick={props.onAddCustomEmojiClick}
            />
        </div>
    );
}
