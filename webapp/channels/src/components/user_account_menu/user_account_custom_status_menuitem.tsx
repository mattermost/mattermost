// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import type {MouseEvent, TouchEvent, KeyboardEvent, ReactNode} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {PulsatingDot} from '@mattermost/components';
import {type UserCustomStatus, CustomStatusDuration} from '@mattermost/types/users';

import {unsetCustomStatus} from 'mattermost-redux/actions/users';

import {showStatusDropdownPulsatingDot} from 'selectors/views/custom_status';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';
import * as Menu from 'components/menu';
import WithTooltip from 'components/with_tooltip';

interface Props {
    timezone?: string;
    customStatus?: UserCustomStatus;
    openCustomStatusModal: (event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;
}

export default function UserAccountSetCustomStatusMenuItem(props: Props) {
    const {formatMessage, formatTime, formatDate} = useIntl();
    const dispatch = useDispatch();

    const showPulsatingDot = useSelector(showStatusDropdownPulsatingDot);

    function handleClear(event: MouseEvent<HTMLElement> | TouchEvent) {
        event.stopPropagation();
        dispatch(unsetCustomStatus());
    }

    const hasStatusWithText = Boolean(props.customStatus?.text?.length);
    const hasStatusWithExpiry = props.customStatus?.duration !== CustomStatusDuration.DONT_CLEAR && props.customStatus?.expires_at;
    const hasStatusWithNoExpiry = props.customStatus?.duration === CustomStatusDuration.DONT_CLEAR;

    let label;
    let ariaDescription: string;
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
        ariaDescription = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithTextAndExpiry.ariaDescription',
            defaultMessage: 'Status is "{text}" and expires at {time}. Set a custom status.',
        }, {
            text: props.customStatus?.text,
            time: `${formatTime(props.customStatus?.expires_at)} ${formatDate(props.customStatus?.expires_at)}`,
        });
    } else if (hasStatusWithText && hasStatusWithNoExpiry) {
        label = (
            <CustomStatusText
                text={props.customStatus?.text}
            />
        );
        ariaDescription = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithTextAndNoExpiry.ariaDescription',
            defaultMessage: 'Status is "{text}". Set a custom status.',
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
        ariaDescription = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.hasStatusWithExpiryAndNoText.ariaDescription',
            defaultMessage: 'Status expires at {time}. Set a custom status.',
        }, {
            time: `${formatTime(props.customStatus?.expires_at)} ${formatDate(props.customStatus?.expires_at)}`,
        });
    } else {
        label = (
            <FormattedMessage
                id='userAccountMenu.setCustomStatusMenuItem.noStatusTextSet'
                defaultMessage='Set custom status text'
            />
        );
        ariaDescription = formatMessage({
            id: 'userAccountMenu.setCustomStatusMenuItem.noStatusTextSet',
            defaultMessage: 'Set custom status text',
        });
    }

    let trailingElement: ReactNode | null = null;
    if (showPulsatingDot) {
        trailingElement = <PulsatingDot/>;
    } else if (hasStatusWithText || hasStatusWithExpiry || hasStatusWithNoExpiry) {
        trailingElement = (
            <WithTooltip
                title={formatMessage({id: 'userAccountMenu.setCustomStatusMenuItem.clearTooltip', defaultMessage: 'Clear custom status'})}
            >
                <i
                    className='icon icon-close-circle userAccountMenu_menuItemTrailingIconClear'
                    aria-hidden='true'
                    onClick={handleClear}
                />
            </WithTooltip>
        );
    }

    return (
        <Menu.Item
            className={classNames('userAccountMenu_customStatusMenuItem', {
                hasTrailingElement: Boolean(trailingElement),
            })}
            leadingElement={
                <CustomStatusEmoji
                    showTooltip={false}
                    emojiStyle={{marginLeft: 0}}
                    emojiSize={16}
                />
            }
            labels={label}
            trailingElements={trailingElement}
            aria-description={ariaDescription}
            onClick={props.openCustomStatusModal}
        />
    );
}
