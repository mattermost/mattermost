// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {CSSProperties, RefObject} from 'react';
import React, {PureComponent, createRef} from 'react';
import {Tab, Tabs} from 'react-bootstrap';
import type {WrappedComponentProps} from 'react-intl';
import {injectIntl, FormattedMessage} from 'react-intl';

import type {Emoji} from '@mattermost/types/emojis';

import {makeAsyncComponent} from 'components/async_load';
import EmojiPicker from 'components/emoji_picker';
import EmojiPickerHeader from 'components/emoji_picker/components/emoji_picker_header';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import GifIcon from 'components/widgets/icons/giphy_icon';

const GifPicker = makeAsyncComponent('GifPicker', React.lazy(() => import('components/gif_picker/gif_picker')));

export interface Props extends WrappedComponentProps {
    style?: CSSProperties;
    rightOffset?: number;
    topOffset?: number;
    leftOffset?: number;
    placement?: ('top' | 'bottom' | 'left' | 'right');
    onEmojiClose: () => void;
    onEmojiClick: (emoji: Emoji) => void;
    onGifClick?: (gif: string) => void;
    onAddCustomEmojiClick?: () => void;
    enableGifPicker?: boolean;
}

type State = {
    emojiTabVisible: boolean;
    filter: string;
    activeKey: number;
}

class EmojiPickerTabs extends PureComponent<Props, State> {
    private rootPickerNodeRef: RefObject<HTMLDivElement>;

    static defaultProps = {
        rightOffset: 0,
        topOffset: 0,
        leftOffset: 0,
    };

    constructor(props: Props) {
        super(props);

        this.state = {
            emojiTabVisible: true,
            filter: '',
            activeKey: 1,
        };

        this.rootPickerNodeRef = createRef();
    }

    handleEmojiPickerClose = () => {
        this.props.onEmojiClose();
    };

    handleFilterChange = (filter: string) => {
        this.setState({filter});
    };

    getRootPickerNode = () => {
        return this.rootPickerNodeRef.current;
    };

    render() {
        const {intl} = this.props;
        let pickerStyle;

        if (this.props.style && !(this.props.style.left === 0 && this.props.style.top === 0)) {
            if (this.props.placement === 'top' || this.props.placement === 'bottom') {
                // Only take the top/bottom position passed by React Bootstrap since we want to be right-aligned
                pickerStyle = {
                    top: this.props.style.top,
                    bottom: this.props.style.bottom,
                    right: this.props?.rightOffset,
                };
            } else {
                pickerStyle = {...this.props.style};
            }

            if (pickerStyle.top) {
                pickerStyle.top = (this.props.topOffset || 0) + (pickerStyle.top as number);
            } else {
                pickerStyle.top = this.props.topOffset;
            }

            if (pickerStyle.left) {
                (pickerStyle.left as number) += (this.props.leftOffset || 0);
            }
        }

        if (this.props.enableGifPicker && typeof this.props.onGifClick != 'undefined') {
            return (
                <div
                    id='emojiGifPicker'
                    ref={this.rootPickerNodeRef}
                    style={pickerStyle}
                    className={classNames('a11y__popup', 'emoji-picker', {
                        bottom: this.props.placement === 'bottom',
                    })}
                    role='dialog'
                    aria-label={this.state.activeKey === 1 ? intl.formatMessage({id: 'emoji_gif_picker.dialog.emojis', defaultMessage: 'Emoji Picker'}) : intl.formatMessage({id: 'emoji_gif_picker.dialog.gifs', defaultMessage: 'GIF Picker'})
                    }

                    aria-modal='true'
                >
                    <Tabs
                        id='emoji-picker-tabs'
                        defaultActiveKey={1}
                        justified={true}
                        mountOnEnter={true}
                        unmountOnExit={true}
                        activeKey={this.state.activeKey}
                        onSelect={(activeKey) => this.setState({activeKey})}
                    >
                        <EmojiPickerHeader handleEmojiPickerClose={this.handleEmojiPickerClose}/>
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
                                filter={this.state.filter}
                                onEmojiClick={this.props.onEmojiClick}
                                handleFilterChange={this.handleFilterChange}
                                handleEmojiPickerClose={this.handleEmojiPickerClose}
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
                                filter={this.state.filter}
                                getRootPickerNode={this.getRootPickerNode}
                                onGifClick={this.props.onGifClick}
                                handleFilterChange={this.handleFilterChange}
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
                    bottom: this.props.placement === 'bottom',
                })}
                role='dialog'
                aria-label={
                    intl.formatMessage({id: 'emoji_gif_picker.dialog.emojis', defaultMessage: 'Emoji Picker'})}
                aria-modal='true'
            >
                <EmojiPickerHeader handleEmojiPickerClose={this.handleEmojiPickerClose}/>
                <EmojiPicker
                    filter={this.state.filter}
                    onEmojiClick={this.props.onEmojiClick}
                    handleFilterChange={this.handleFilterChange}
                    handleEmojiPickerClose={this.handleEmojiPickerClose}
                    onAddCustomEmojiClick={this.props.onAddCustomEmojiClick}
                />
            </div>
        );
    }
}

export default injectIntl(EmojiPickerTabs);
