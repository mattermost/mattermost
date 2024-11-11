// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactElement, MouseEvent, TouchEvent, KeyboardEvent} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {PulsatingDot} from '@mattermost/components';
import {type UserCustomStatus, CustomStatusDuration} from '@mattermost/types/users';

import {unsetCustomStatus} from 'mattermost-redux/actions/users';

import {isCustomStatusEnabled, showStatusDropdownPulsatingDot} from 'selectors/views/custom_status';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';
import * as Menu from 'components/menu';
import EmojiIcon from 'components/widgets/icons/emoji_icon';
import WithTooltip from 'components/with_tooltip';

interface Props {
    timezone?: string;
    customStatus?: UserCustomStatus;
    isCustomStatusExpired: boolean;
    openCustomStatusModal: (event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;
}

export default function UserAccountSetCustomStatusMenuItem(props: Props) {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();

    const customStatusEnabled = useSelector(isCustomStatusEnabled);

    const showPulsatingDot = useSelector(showStatusDropdownPulsatingDot);

    if (!customStatusEnabled) {
        return null;
    }

    const isCustomStatusSet = !props.isCustomStatusExpired && props.customStatus && (props.customStatus?.text?.length > 0 || props.customStatus?.emoji?.length > 0);

    if (!isCustomStatusSet) {
        return (
            <>
                <Menu.Item
                    className='userAccountMenu_setCustomStatusMenuItem'
                    leadingElement={<EmojiIcon className='userAccountMenu_setCustomStatusMenuItem_icon'/>}
                    labels={
                        <FormattedMessage
                            id='userAccountMenu.setCustomStatusMenuItem.noStatusSet'
                            defaultMessage='Set a custom status'
                        />
                    }
                    aria-label={formatMessage({
                        id: 'userAccountMenu.setCustomStatusMenuItem.noStatusSet.ariaLabel',
                        defaultMessage: 'Click to set a custom status',
                    })}
                    onClick={props.openCustomStatusModal}
                />
                <Menu.Separator/>
            </>
        );
    }

    function handleClear(event: MouseEvent<HTMLElement> | TouchEvent) {
        event.stopPropagation();
        dispatch(unsetCustomStatus());
    }

    const hasStatusWithText = Boolean(props.customStatus?.text?.length);
    const hasStatusWithExpiry = props.customStatus?.duration !== CustomStatusDuration.DONT_CLEAR && props.customStatus?.expires_at;
    const hasStatusWithNoExpiry = props.customStatus?.duration === CustomStatusDuration.DONT_CLEAR;

    let label: ReactElement;
    let trailingElement = showPulsatingDot ? <PulsatingDot/> : (
        <WithTooltip
            id='userAccountMenu.setCustomStatusMenuItem.clearTooltip'
            placement='left'
            title={formatMessage({id: 'userAccountMenu.setCustomStatusMenuItem.clearTooltip', defaultMessage: 'Clear custom status'})}
        >
            <i
                className='icon icon-close-circle userAccountMenu_menuItemTrailingIconClear'
                aria-label={formatMessage({id: 'userAccountMenu.setCustomStatusMenuItem.clear', defaultMessage: 'Click to clear custom status'})}
                onClick={handleClear}
            />
        </WithTooltip>
    );
    let ariaLabel: string;
    if (hasStatusWithText && hasStatusWithExpiry) {
        label = (
            <>
                <CustomStatusText
                    text={props.customStatus?.text}
                />
                <ExpiryTime
                    time={props.customStatus?.expires_at ?? ''}
                    timezone={props.timezone}
                    withinBrackets={true}
                />
            </>
        );
        ariaLabel = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithTextAndExpiry.ariaLabel',
            defaultMessage: 'Custom status set as "{text}" and expires at {time}. Click to change.',
        }, {
            text: props.customStatus?.text,
            time: props.customStatus?.expires_at,
        });
    } else if (hasStatusWithText && hasStatusWithNoExpiry) {
        label = (
            <CustomStatusText
                text={props.customStatus?.text}
            />
        );
        ariaLabel = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithTextAndNoExpiry.ariaLabel',
            defaultMessage: 'Custom status set as "{text}". Click to change.',
        }, {
            text: props.customStatus?.text,
        });
    } else if (!hasStatusWithText && hasStatusWithExpiry) {
        label = (
            <ExpiryTime
                time={props.customStatus?.expires_at ?? ''}
                timezone={props.timezone}
                withinBrackets={true}
            />
        );
        ariaLabel = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithExpiryAndNoText.ariaLabel',
            defaultMessage: 'Custom status expires at {time}. Click to change.',
        }, {
            time: props.customStatus?.expires_at,
        });
    } else {
        label = (
            <FormattedMessage
                id='userAccountPopover.menuItem.setCustomStatus.noStatusTextSet'
                defaultMessage='Set custom status text...'
            />
        );
        ariaLabel = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithNoTextAndExpiry.ariaLabel',
            defaultMessage: 'Click to set a custom status',
        });
        trailingElement = showPulsatingDot ? <PulsatingDot/> : <></>;
    }

    return (
        <>
            <Menu.Item
                leadingElement={
                    <CustomStatusEmoji
                        showTooltip={false}
                        emojiStyle={{marginLeft: 0}}
                        emojiSize={16}
                        aria-hidden='true'
                    />
                }
                labels={label}
                trailingElements={trailingElement}
                aria-label={ariaLabel}
                onClick={props.openCustomStatusModal}
            />
            <Menu.Separator/>
        </>
    );
}
