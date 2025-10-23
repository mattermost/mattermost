// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useState} from 'react';
import {FormattedMessage} from 'react-intl';

import RenderEmoji from '@mattermost/design-system/src/components/primitives/emoji/render_emoji';
import WithTooltip from '@mattermost/design-system/src/components/primitives/with_tooltip';
import type {UserCustomStatus} from '@mattermost/types/users';
import {CustomStatusDuration} from '@mattermost/types/users';

import {durationValues} from 'utils/constants';
import {useEmojiImageUrl} from 'utils/emoji_utils';

import CustomStatusText from './custom_status_text';

import './custom_status.scss';

type Props = {
    handleSuggestionClick: (status: UserCustomStatus) => void;
    handleClear?: (status: UserCustomStatus) => void;
    status: UserCustomStatus;
};

const CustomStatusSuggestion: React.FC<Props> = (props: Props) => {
    const {handleSuggestionClick, handleClear, status} = props;
    const {emoji, text, duration} = status;
    const [show, setShow] = useState(false);
    const emojiImageURL = useEmojiImageUrl(emoji);

    const showClearButton = () => setShow(true);

    const hideClearButton = () => setShow(false);

    const handleRecentCustomStatusClear = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        event.preventDefault();
        if (handleClear) {
            handleClear(status);
        }
    };

    const clearButton = handleClear ? (
        <div className='suggestion-clear'>
            <WithTooltip
                title={
                    <FormattedMessage
                        id='custom_status.suggestions.clear'
                        defaultMessage='Clear'
                    />
                }
            >
                <button
                    className='style--none input-clear-x'
                    onClick={handleRecentCustomStatusClear}
                >
                    <i className='icon icon-close-circle'/>
                </button>
            </WithTooltip>
        </div>
    ) : null;

    return (
        <button
            className='statusSuggestion__row cursor--pointer'
            onMouseEnter={showClearButton}
            onMouseLeave={hideClearButton}
            onClick={() => handleSuggestionClick(status)}
            tabIndex={0}
        >
            <div className='statusSuggestion__icon'>
                <RenderEmoji
                    emojiName={emoji}
                    emojiImageURL={emojiImageURL}
                    size={20}
                />
            </div>
            <CustomStatusText
                text={text}
                className={classNames('statusSuggestion__text', {
                    with_duration: duration,
                })}
            />
            {duration &&
            duration !== CustomStatusDuration.CUSTOM_DATE_TIME &&
            duration !== CustomStatusDuration.DATE_AND_TIME && (
                <span className='statusSuggestion__duration'>
                    <FormattedMessage
                        id={durationValues[duration].id}
                        defaultMessage={durationValues[duration].defaultMessage}
                    />
                </span>
            )}
            {show && clearButton}
        </button>
    );
};

export default CustomStatusSuggestion;
