// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {CSSProperties} from 'react';
import React, {useCallback, useRef, useState} from 'react';
import {Tab, Tabs} from 'react-bootstrap';
import {FormattedMessage} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import {makeAsyncComponent} from 'components/async_load';
import EmojiPicker from 'components/emoji_picker';
import EmojiPickerHeader from 'components/emoji_picker/components/emoji_picker_header';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import GifIcon from 'components/widgets/icons/giphy_icon';

const GifPicker = makeAsyncComponent('GifPicker', React.lazy(() => import('components/gif_picker/gif_picker')));

export interface Props {
    style?: CSSProperties; // Injected by EmojiPickerOverlay
    rightOffset?: number;
    topOffset?: number;
    leftOffset?: number;
    placement?: ('top' | 'bottom' | 'left' | 'right'); // Injected by EmojiPickerOverlay
    onEmojiClose: () => void;
    onEmojiClick: (emoji: Emoji) => void;
    onGifClick?: (gif: string) => void;
    onAddCustomEmojiClick?: () => void;
    enableGifPicker?: boolean;
}

export default function EmojiPickerTabs(props: Props) {
    const [filter, setFilter] = useState('');

    const rootPickerNodeRef = useRef<HTMLDivElement>(null);
    const getRootPickerNode = useCallback(() => rootPickerNodeRef.current, []);

    let pickerStyle;

    // if (props.style && !(props.style.left === 0 && props.style.top === 0)) {
    //     if (props.placement === 'top' || props.placement === 'bottom') {
    //         // Only take the top/bottom position passed by React Bootstrap since we want to be right-aligned
    //         pickerStyle = {
    //             top: props.style.top,
    //             bottom: props.style.bottom,
    //             right: props?.rightOffset,
    //         };
    //     } else {
    //         pickerStyle = {...props.style};
    //     }

    //     if (pickerStyle.top) {
    //         pickerStyle.top = (props.topOffset || 0) + (pickerStyle.top as number);
    //     } else {
    //         pickerStyle.top = props.topOffset;
    //     }

    //     if (pickerStyle.left) {
    //         (pickerStyle.left as number) += (props.leftOffset || 0);
    //     }
    // }

    if (props.enableGifPicker && typeof props.onGifClick != 'undefined') {
        return (
            <div
                id='emojiGifPicker'
                ref={rootPickerNodeRef}
                style={pickerStyle}
                className={classNames('a11y__popup', 'emoji-picker', {
                    bottom: props.placement === 'bottom',
                })}
            >
                <Tabs
                    id='emoji-picker-tabs'
                    defaultActiveKey={1}
                    justified={true}
                    mountOnEnter={true}
                    unmountOnExit={true}
                >
                    <EmojiPickerHeader handleEmojiPickerClose={props.onEmojiClose}/>
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
            style={pickerStyle}
            className={classNames('a11y__popup', 'emoji-picker', 'emoji-picker--single', {
                bottom: props.placement === 'bottom',
            })}
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
