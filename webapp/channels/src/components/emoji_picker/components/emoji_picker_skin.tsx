// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React from 'react';
import {FormattedMessage, defineMessage, injectIntl} from 'react-intl';
import type {IntlShape, MessageDescriptor} from 'react-intl';
import {CSSTransition} from 'react-transition-group';

import {CloseIcon} from '@mattermost/compass-icons/components';
import type {SystemEmoji} from '@mattermost/types/emojis';

import WithTooltip from 'components/with_tooltip';

import imgTrans from 'images/img_trans.gif';
import * as Emoji from 'utils/emoji';

interface SkinTone {
    emoji: SystemEmoji;
    label: MessageDescriptor;
    value: string;
}

const skinTones = [
    {
        emoji: Emoji.Emojis[Emoji.EmojiIndicesByAlias.get('raised_hand_with_fingers_splayed_dark_skin_tone')!],
        label: defineMessage({
            id: 'emoji_skin.dark_skin_tone',
            defaultMessage: 'Dark skin tone',
        }),
        value: '1F3FF',
    },
    {
        emoji: Emoji.Emojis[Emoji.EmojiIndicesByAlias.get('raised_hand_with_fingers_splayed_medium_dark_skin_tone')!],
        label: defineMessage({
            id: 'emoji_skin.medium_dark_skin_tone',
            defaultMessage: 'Medium dark skin tone',
        }),
        value: '1F3FE',
    },
    {
        emoji: Emoji.Emojis[Emoji.EmojiIndicesByAlias.get('raised_hand_with_fingers_splayed_medium_skin_tone')!],
        label: defineMessage({
            id: 'emoji_skin.medium_skin_tone',
            defaultMessage: 'Medium skin tone',
        }),
        value: '1F3FD',
    },
    {
        emoji: Emoji.Emojis[Emoji.EmojiIndicesByAlias.get('raised_hand_with_fingers_splayed_medium_light_skin_tone')!],
        label: defineMessage({
            id: 'emoji_skin.medium_light_skin_tone',
            defaultMessage: 'Medium light skin tone',
        }),
        value: '1F3FC',
    },
    {
        emoji: Emoji.Emojis[Emoji.EmojiIndicesByAlias.get('raised_hand_with_fingers_splayed_light_skin_tone')!],
        label: defineMessage({
            id: 'emoji_skin.light_skin_tone',
            defaultMessage: 'Light skin tone',
        }),
        value: '1F3FB',
    },
    {
        emoji: Emoji.Emojis[Emoji.EmojiIndicesByAlias.get('raised_hand_with_fingers_splayed')!],
        label: defineMessage({
            id: 'emoji_skin.default',
            defaultMessage: 'Default skin tone',
        }),
        value: 'default',
    },
] satisfies SkinTone[];

export type Props = {
    userSkinTone: string;
    onSkinSelected: (skin: string) => void;
    intl: IntlShape;
};

type State = {
    pickerExtended: boolean;
}

export class EmojiPickerSkin extends React.PureComponent<Props, State> {
    constructor(props: Props) {
        super(props);

        this.state = {
            pickerExtended: false,
        };
    }

    ariaLabel = (skinTone: SkinTone) => {
        return this.props.intl.formatMessage({
            id: 'emoji_skin_item.emoji_aria_label',
            defaultMessage: '{skinName} emoji',
        },
        {
            skinName: this.props.intl.formatMessage(skinTone.label),
        });
    };

    hideSkinTonePicker = (skin: string) => {
        this.setState({pickerExtended: false});
        if (skin !== this.props.userSkinTone) {
            this.props.onSkinSelected(skin);
        }
    };

    showSkinTonePicker = () => {
        this.setState({pickerExtended: true});
    };

    extended() {
        const closeButtonLabel = this.props.intl.formatMessage({
            id: 'emoji_skin.close',
            defaultMessage: 'Close skin tones',
        });
        const choices = skinTones.map((skinTone) => {
            const skin = skinTone.value;
            const emoji = skinTone.emoji;
            const spriteClassName = classNames('emojisprite', `emoji-category-${emoji.category}`, `emoji-${emoji.unified.toLowerCase()}`);

            return (
                <button
                    className='style--none skin-tones__icon'
                    data-testid={`skin-pick-${skin}`}
                    aria-label={this.ariaLabel(skinTone)}
                    key={skin}
                    onClick={() => this.hideSkinTonePicker(skin)}
                >
                    <img
                        src={imgTrans}
                        className={spriteClassName}
                    />
                </button>
            );
        });
        return (
            <>
                <div className='skin-tones__close'>
                    <button
                        className='skin-tones__close-icon style--none'
                        onClick={() => this.hideSkinTonePicker(this.props.userSkinTone)}
                        aria-label={closeButtonLabel}
                    >
                        <CloseIcon
                            size={16}
                            color={'rgba(var(--center-channel-color-rgb), 0.75)'}
                        />
                    </button>
                    <div className='skin-tones__close-text'>
                        <FormattedMessage
                            {...skinTones[skinTones.length - 1].label}
                        />
                    </div>
                </div>
                <div className='skin-tones__icons'>
                    {choices}
                </div>
            </>
        );
    }

    collapsed() {
        const emoji = skinTones.find(({value}) => value === this.props.userSkinTone)!.emoji;
        const spriteClassName = classNames('emojisprite', `emoji-category-${emoji?.category}`, `emoji-${emoji?.unified.toLowerCase()}`);
        const expandButtonLabel = this.props.intl.formatMessage({
            id: 'emoji_picker.skin_tone',
            defaultMessage: 'Skin tone',
        });

        return (
            <WithTooltip
                id='emojiPickerSkinTooltip'
                placement='top'
                title={expandButtonLabel}
            >
                <button
                    data-testid={`skin-picked-${this.props.userSkinTone}`}
                    className='style--none skin-tones__icon skin-tones__expand-icon'
                    onClick={this.showSkinTonePicker}
                    aria-label={expandButtonLabel}
                >
                    <img
                        alt={'emoji skin tone picker'}
                        src={imgTrans}
                        className={spriteClassName}
                    />
                </button>
            </WithTooltip>
        );
    }

    render() {
        return (
            <CSSTransition
                in={this.state.pickerExtended}
                classNames='skin-tones-animation'
                timeout={200}
            >
                <div className={classNames('skin-tones', {'skin-tones--active': this.state.pickerExtended})}>
                    <div className={classNames('skin-tones__content', {'skin-tones__content__single': !this.state.pickerExtended})}>
                        {this.state.pickerExtended ? this.extended() : this.collapsed()}
                    </div>
                </div>
            </CSSTransition>
        );
    }
}

export default injectIntl(EmojiPickerSkin);
