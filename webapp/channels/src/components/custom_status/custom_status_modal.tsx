// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {useRouteMatch} from 'react-router-dom';

import classNames from 'classnames';
import type {Moment} from 'moment-timezone';
import moment from 'moment-timezone';

import {GenericModal} from '@mattermost/components';
import type {Emoji} from '@mattermost/types/emojis';
import type {UserCustomStatus} from '@mattermost/types/users';
import {CustomStatusDuration} from '@mattermost/types/users';

import {setCustomStatusInitialisationState} from 'mattermost-redux/actions/preferences';
import {setCustomStatus, unsetCustomStatus, removeRecentCustomStatus} from 'mattermost-redux/actions/users';
import {Preferences} from 'mattermost-redux/constants';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

import {loadCustomEmojisIfNeeded} from 'actions/emoji_actions';
import {closeModal} from 'actions/views/modals';
import {makeGetCustomStatus, getRecentCustomStatuses, showStatusDropdownPulsatingDot, isCustomStatusExpired} from 'selectors/views/custom_status';

import CustomStatusSuggestion from 'components/custom_status/custom_status_suggestion';
import DateTimeInput, {getRoundedTime} from 'components/custom_status/date_time_input';
import ExpiryMenu from 'components/custom_status/expiry_menu';
import RenderEmoji from 'components/emoji/render_emoji';
import EmojiPickerOverlay from 'components/emoji_picker/emoji_picker_overlay';
import QuickInput, {MaxLengthInput} from 'components/quick_input';
import EmojiIcon from 'components/widgets/icons/emoji_icon';

import type {GlobalState} from 'types/store';
import {A11yCustomEventTypes, Constants, ModalIdentifiers} from 'utils/constants';
import type {A11yFocusEventDetail} from 'utils/constants';
import {t} from 'utils/i18n';
import {isKeyPressed} from 'utils/keyboard';
import {getCurrentMomentForTimezone} from 'utils/timezone';
import {localizeMessage} from 'utils/utils';

import 'components/category_modal.scss';
import './custom_status.scss';

type Props = {
    onExited: () => void;
};

// This is the same limit set
// https://github.com/mattermost/mattermost-server/pull/16835/files#diff-73c61af5954b16f5e3cb5ee786af9eb698f660eff0d65db5556949be5fb6e60bR15
const CUSTOM_STATUS_TEXT_CHARACTER_LIMIT = 100;
const EMOJI_PICKER_WIDTH_OFFSET = 308;

type DefaultUserCustomStatus = {
    emoji: string;
    message: string;
    messageDefault: string;
    duration: CustomStatusDuration;
};

const {
    DONT_CLEAR,
    THIRTY_MINUTES,
    ONE_HOUR,
    FOUR_HOURS,
    TODAY,
    THIS_WEEK,
    DATE_AND_TIME,
    CUSTOM_DATE_TIME,
} = CustomStatusDuration;

const defaultCustomStatusSuggestions: DefaultUserCustomStatus[] = [
    {
        emoji: 'calendar',
        message: t('custom_status.suggestions.in_a_meeting'),
        messageDefault: 'In a meeting',
        duration: ONE_HOUR,
    },
    {
        emoji: 'hamburger',
        message: t('custom_status.suggestions.out_for_lunch'),
        messageDefault: 'Out for lunch',
        duration: THIRTY_MINUTES,
    },
    {
        emoji: 'sneezing_face',
        message: t('custom_status.suggestions.out_sick'),
        messageDefault: 'Out sick',
        duration: TODAY,
    },
    {
        emoji: 'house',
        message: t('custom_status.suggestions.working_from_home'),
        messageDefault: 'Working from home',
        duration: TODAY,
    },
    {
        emoji: 'palm_tree',
        message: t('custom_status.suggestions.on_a_vacation'),
        messageDefault: 'On a vacation',
        duration: THIS_WEEK,
    },
];

const defaultDuration = TODAY;
const CustomStatusModal: React.FC<Props> = (props: Props) => {
    const getCustomStatus = useMemo(makeGetCustomStatus, []);
    const dispatch = useDispatch();
    const currentCustomStatus = useSelector(getCustomStatus);
    const customStatusExpired = useSelector((state: GlobalState) => isCustomStatusExpired(state, currentCustomStatus));
    const recentCustomStatuses = useSelector(getRecentCustomStatuses);
    const customStatusControlRef = useRef<HTMLDivElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const {formatMessage} = useIntl();
    const isCurrentCustomStatusSet = !customStatusExpired && (currentCustomStatus?.text || currentCustomStatus?.emoji);
    const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
    const [text, setText] = useState<string>(isCurrentCustomStatusSet ? currentCustomStatus?.text : '');
    const [emoji, setEmoji] = useState<string>(isCurrentCustomStatusSet ? currentCustomStatus?.emoji : '');
    const initialDuration = isCurrentCustomStatusSet ? currentCustomStatus?.duration : defaultDuration;
    const [duration, setDuration] = useState<CustomStatusDuration>(initialDuration === undefined ? defaultDuration : initialDuration);
    const isStatusSet = Boolean(emoji || text);
    const firstTimeModalOpened = useSelector(showStatusDropdownPulsatingDot);
    const timezone = useSelector(getCurrentTimezone);
    const inCustomEmojiPath = useRouteMatch('/:team/emoji');

    const currentTime = getCurrentMomentForTimezone(timezone);
    let initialCustomExpiryTime: Moment = getRoundedTime(currentTime);
    if (isCurrentCustomStatusSet && currentCustomStatus?.duration === DATE_AND_TIME && currentCustomStatus?.expires_at) {
        initialCustomExpiryTime = moment(currentCustomStatus.expires_at);
    }
    const [customExpiryTime, setCustomExpiryTime] = useState<Moment>(initialCustomExpiryTime);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState<boolean>(false);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (isKeyPressed(event, Constants.KeyCodes.ESCAPE) && !isDatePickerOpen) {
            props.onExited();
        }
    }, [isDatePickerOpen, props.onExited]);

    useEffect(() => {
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    const handleCustomStatusInitializationState = () => {
        if (firstTimeModalOpened) {
            dispatch(setCustomStatusInitialisationState({[Preferences.CUSTOM_STATUS_MODAL_VIEWED]: true}));
        }
    };

    const loadCustomEmojisForRecentStatuses = () => {
        const emojisToLoad = new Set<string>();
        recentCustomStatuses.forEach((customStatus: UserCustomStatus) => emojisToLoad.add(customStatus.emoji));
        dispatch(loadCustomEmojisIfNeeded(Array.from(emojisToLoad)));
    };

    const handleStatusExpired = () => {
        if (customStatusExpired && currentCustomStatus) {
            dispatch(unsetCustomStatus());
        }
    };

    useEffect(() => {
        handleCustomStatusInitializationState();
        loadCustomEmojisForRecentStatuses();
        handleStatusExpired();
    }, []);

    useEffect(() => {
        if (inCustomEmojiPath) {
            dispatch(closeModal(ModalIdentifiers.CUSTOM_STATUS));
        }
    }, [inCustomEmojiPath]);

    const handleSetStatus = () => {
        const expiresAt = calculateExpiryTime();
        const customStatus: UserCustomStatus = {
            emoji: emoji || 'speech_balloon',
            text: text.trim(),
            duration: duration === CUSTOM_DATE_TIME ? DATE_AND_TIME : duration,
        };
        if (expiresAt) {
            customStatus.expires_at = expiresAt;
        }
        dispatch(setCustomStatus(customStatus));
    };

    const calculateExpiryTime = (): string => {
        switch (duration) {
        case DONT_CLEAR:
            return '';
        case THIRTY_MINUTES:
            return moment().add(30, 'minutes').seconds(0).milliseconds(0).toISOString();
        case ONE_HOUR:
            return moment().add(1, 'hour').seconds(0).milliseconds(0).toISOString();
        case FOUR_HOURS:
            return moment().add(4, 'hours').seconds(0).milliseconds(0).toISOString();
        case TODAY:
            return moment().endOf('day').toISOString();
        case THIS_WEEK:
            return moment().endOf('week').toISOString();
        case DATE_AND_TIME:
        case CUSTOM_DATE_TIME:
            return customExpiryTime.toISOString();
        default:
            return '';
        }
    };

    const handleClearStatus = isCurrentCustomStatusSet ? () => dispatch(unsetCustomStatus()) : undefined;

    const getCustomStatusControlRef = () => customStatusControlRef.current;

    const handleEmojiClose = () => {
        setShowEmojiPicker(false);
        if (emojiButtonRef.current) {
            document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
                A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target: emojiButtonRef.current as HTMLElement,
                        keyboardOnly: true,
                    },
                },
            ));
        }
    };

    const handleEmojiExited = () => {
        if (emojiButtonRef.current) {
            document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
                A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target: emojiButtonRef.current as HTMLElement,
                        keyboardOnly: true,
                    },
                },
            ));
        }
    };

    const handleEmojiClick = (selectedEmoji: Emoji) => {
        setShowEmojiPicker(false);
        const emojiName = ('short_name' in selectedEmoji) ? selectedEmoji.short_name : selectedEmoji.name;
        setEmoji(emojiName);
        if (emojiButtonRef.current) {
            document.dispatchEvent(new CustomEvent<A11yFocusEventDetail>(
                A11yCustomEventTypes.FOCUS, {
                    detail: {
                        target: emojiButtonRef.current as HTMLElement,
                        keyboardOnly: true,
                    },
                },
            ));
        }
    };

    const toggleEmojiPicker = (e?: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        e?.stopPropagation();
        setShowEmojiPicker((prevShow) => !prevShow);
    };

    const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => setText(event.target.value);

    const handleRecentCustomStatusClear = (status: UserCustomStatus) => dispatch(removeRecentCustomStatus(status));

    const customStatusEmoji = emoji || text ? (
        <RenderEmoji
            emojiName={emoji || 'speech_balloon'}
            size={20}
        />
    ) : <EmojiIcon className={'icon icon--emoji'}/>;

    const clearHandle = () => {
        setEmoji('');
        setText('');
        setDuration(defaultDuration);
    };

    const handleSuggestionClick = (status: UserCustomStatus) => {
        setEmoji(status.emoji);
        setText(status.text);
        setDuration(status.duration || DONT_CLEAR);
    };

    const calculateRightOffSet = () => {
        let rightOffset = Constants.DEFAULT_EMOJI_PICKER_RIGHT_OFFSET;
        const target = getCustomStatusControlRef();
        if (target) {
            rightOffset = window.innerWidth - target.getBoundingClientRect().left - EMOJI_PICKER_WIDTH_OFFSET;
            if (rightOffset < 0) {
                rightOffset = Constants.DEFAULT_EMOJI_PICKER_RIGHT_OFFSET;
            }
        }

        return rightOffset;
    };

    const recentStatuses = (
        <div id='statusSuggestion__recents'>
            <div className='statusSuggestion__title'>
                {formatMessage({id: 'custom_status.suggestions.recent_title', defaultMessage: 'RECENT'})}
            </div>
            {
                recentCustomStatuses.map((status: UserCustomStatus) => (
                    <CustomStatusSuggestion
                        key={status.text}
                        handleSuggestionClick={handleSuggestionClick}
                        handleClear={handleRecentCustomStatusClear}
                        status={status}
                    />
                ))
            }
        </div>
    );

    const renderCustomStatusSuggestions = () => {
        const recentCustomStatusTexts = recentCustomStatuses.map((status: UserCustomStatus) => status.text);
        const customStatusSuggestions = defaultCustomStatusSuggestions.
            map((status) => ({
                emoji: status.emoji,
                text: formatMessage({id: status.message, defaultMessage: status.messageDefault}),
                duration: status.duration,
            })).
            filter((status: UserCustomStatus) => !recentCustomStatusTexts.includes(status.text)).
            map((status: UserCustomStatus, index: number) => (
                <CustomStatusSuggestion
                    key={index}
                    handleSuggestionClick={handleSuggestionClick}
                    status={status}
                />
            ));

        if (customStatusSuggestions.length <= 0) {
            return null;
        }

        return (
            <>
                <div className='statusSuggestion__title'>
                    {formatMessage({id: 'custom_status.suggestions.title', defaultMessage: 'SUGGESTIONS'})}
                </div>
                {customStatusSuggestions}
            </>
        );
    };

    const areEmojiAndTextSame = currentCustomStatus?.emoji === emoji && currentCustomStatus?.text === text;
    const areSelectedAndSetStatusSame = areEmojiAndTextSame && duration === currentCustomStatus?.duration;

    const showSuggestions = !isStatusSet || areSelectedAndSetStatusSame;

    const disableSetStatus = !isStatusSet || text.length > CUSTOM_STATUS_TEXT_CHARACTER_LIMIT;

    const showDateAndTimeField = !showSuggestions && (duration === CUSTOM_DATE_TIME || duration === DATE_AND_TIME);

    const suggestion = (
        <div
            className='statusSuggestion'
            style={{marginTop: isStatusSet ? 44 : 8}}
        >
            <div className='statusSuggestion__content'>
                {recentCustomStatuses.length > 0 && recentStatuses}
                <div id='statusSuggestion__suggestions'>
                    {renderCustomStatusSuggestions()}
                </div>
            </div>
        </div>
    );

    return (
        <GenericModal
            enforceFocus={false}
            onExited={props.onExited}
            modalHeaderText={
                <FormattedMessage
                    id='custom_status.set_status'
                    defaultMessage='Set a status'
                />
            }
            confirmButtonText={
                <FormattedMessage
                    id='custom_status.modal_confirm'
                    defaultMessage='Set Status'
                />
            }
            cancelButtonText={
                <FormattedMessage
                    id='custom_status.modal_cancel'
                    defaultMessage='Clear Status'
                />
            }
            isConfirmDisabled={disableSetStatus}
            id='custom_status_modal'
            className={'StatusModal'}
            handleConfirm={handleSetStatus}
            handleEnterKeyPress={handleSetStatus}
            handleCancel={handleClearStatus}
            confirmButtonClassName='btn btn-primary'
            ariaLabel={localizeMessage('custom_status.set_status', 'Set a status')}
            keyboardEscape={false}
            tabIndex={-1}
        >
            <div className='StatusModal__body'>
                <div className='StatusModal__input'>
                    <div
                        ref={customStatusControlRef}
                        className='StatusModal__emoji-container'
                    >
                        {showEmojiPicker && (
                            <EmojiPickerOverlay
                                target={getCustomStatusControlRef}
                                show={showEmojiPicker}
                                onHide={handleEmojiClose}
                                onEmojiClick={handleEmojiClick}
                                rightOffset={calculateRightOffSet()}
                                leftOffset={3}
                                topOffset={3}
                                defaultHorizontalPosition='right'
                                onExited={handleEmojiExited}
                            />
                        )}
                        <button
                            type='button'
                            onClick={toggleEmojiPicker}
                            ref={emojiButtonRef}
                            className={classNames('emoji-picker__container', 'StatusModal__emoji-button', {
                                'StatusModal__emoji-button--active': showEmojiPicker,
                            })}
                        >
                            {customStatusEmoji}
                        </button>
                    </div>
                    <QuickInput
                        inputComponent={MaxLengthInput}
                        value={text}
                        maxLength={CUSTOM_STATUS_TEXT_CHARACTER_LIMIT}
                        clearableWithoutValue={Boolean(isStatusSet)}
                        onClear={clearHandle}
                        className='emoji-quick-input form-control'
                        clearClassName='StatusModal__clear-container'
                        tooltipPosition='top'
                        onChange={handleTextChange}
                        placeholder={formatMessage({id: 'custom_status.set_status', defaultMessage: 'Set a status'})}
                        autoFocus={true}
                    />
                </div>
                {isStatusSet && (
                    <ExpiryMenu
                        duration={duration}
                        expiryTime={showSuggestions ? currentCustomStatus?.expires_at : undefined}
                        handleDurationChange={setDuration}
                    />
                )}
                {showSuggestions && suggestion}
                {showDateAndTimeField && (
                    <DateTimeInput
                        time={customExpiryTime}
                        handleChange={setCustomExpiryTime}
                        timezone={timezone}
                        setIsDatePickerOpen={setIsDatePickerOpen}
                    />
                )}
            </div>
        </GenericModal >
    );
};

export default CustomStatusModal;
