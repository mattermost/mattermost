// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, injectIntl, IntlShape} from 'react-intl';
import classNames from 'classnames';
import {CSSTransition} from 'react-transition-group';

import {CloseIcon} from '@mattermost/compass-icons/components';

import {Constants} from 'utils/constants';
import * as Emoji from 'utils/emoji';
import imgTrans from 'images/img_trans.gif';
import OverlayTrigger from 'components/overlay_trigger';
import Tooltip from 'components/tooltip';

const skinsList = [
    ['raised_hand_with_fingers_splayed_dark_skin_tone', '1F3FF'],
    ['raised_hand_with_fingers_splayed_medium_dark_skin_tone', '1F3FE'],
    ['raised_hand_with_fingers_splayed_medium_skin_tone', '1F3FD'],
    ['raised_hand_with_fingers_splayed_medium_light_skin_tone', '1F3FC'],
    ['raised_hand_with_fingers_splayed_light_skin_tone', '1F3FB'],
    ['raised_hand_with_fingers_splayed', 'default'],
];

const skinToneEmojis = new Map(skinsList.map((pair) => [pair[1], Emoji.Emojis[Emoji.EmojiIndicesByAlias.get(pair[0])!]]));

type Props = {
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

    ariaLabel = (skin: string) => {
        return this.props.intl.formatMessage({
            id: 'emoji_skin_item.emoji_aria_label',
            defaultMessage: '{skinName} emoji',
        },
        {
            skinName: Emoji.SkinTranslations.get(skin),
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
        const choices = skinsList.map((skinPair) => {
            const skin = skinPair[1];
            const emoji = skinToneEmojis.get(skin)!;
            const spriteClassName = classNames('emojisprite', `emoji-category-${emoji.category}`, `emoji-${emoji.unified.toLowerCase()}`);

            return (
                <button
                    className='style--none skin-tones__icon'
                    data-testid={`skin-pick-${skin}`}
                    aria-label={this.ariaLabel(skin)}
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
                            id={Emoji.SkinTranslations.get('default')}
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
        const emoji = skinToneEmojis.get(this.props.userSkinTone)!;
        const spriteClassName = classNames('emojisprite', `emoji-category-${emoji.category}`, `emoji-${emoji.unified.toLowerCase()}`);
        const expandButtonLabel = this.props.intl.formatMessage({
            id: 'emoji_picker.skin_tone',
            defaultMessage: 'Skin tone',
        });

        const tooltip = (
            <Tooltip
                id='skinTooltip'
                className='emoji-tooltip'
            >
                <span>
                    {expandButtonLabel}
                </span>
            </Tooltip>
        );

        return (
            <OverlayTrigger
                trigger={['hover', 'focus']}
                delayShow={Constants.OVERLAY_TIME_DELAY}
                placement='top'
                overlay={tooltip}
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
            </OverlayTrigger>
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
