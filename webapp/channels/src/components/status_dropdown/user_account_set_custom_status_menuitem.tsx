// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {CustomStatusDuration, type UserProfile} from '@mattermost/types/users';

import {isCustomStatusEnabled, makeGetCustomStatus, isCustomStatusExpired} from 'selectors/views/custom_status';

import CustomStatusEmoji from 'components/custom_status/custom_status_emoji';
import CustomStatusText from 'components/custom_status/custom_status_text';
import ExpiryTime from 'components/custom_status/expiry_time';
import * as Menu from 'components/menu';
import EmojiIcon from 'components/widgets/icons/emoji_icon';

import type {GlobalState} from 'types/store';

interface Props {
    userId: UserProfile['id'];
    timezone?: string;
}

export default function UserAccountSetCustomStatusMenuItem(props: Props) {
    const customStatusEnabled = useSelector(isCustomStatusEnabled);

    const getCustomStatus = useMemo(makeGetCustomStatus, []);
    const customStatus = useSelector((state: GlobalState) => getCustomStatus(state, props.userId));

    const customStatusExpired = useSelector((state: GlobalState) => isCustomStatusExpired(state, customStatus));

    if (!customStatusEnabled) {
        return null;
    }

    const isCustomStatusSet = !customStatusExpired && customStatus && (customStatus?.text?.length > 0 || customStatus?.emoji?.length > 0);

    if (!isCustomStatusSet) {
        return (
            <>
                <Menu.Item
                    leadingElement={<EmojiIcon className='userAccountMenu_setCustomStatusMenuItem_icon'/>}
                    labels={
                        <FormattedMessage
                            id='userAccountPopover.menuItem.setCustomStatus.noStatusSet'
                            defaultMessage='Set a custom status'
                        />
                    }
                />
                <Menu.Separator/>
            </>
        );
    }

    let expiryTime: ReactNode = null;
    if (customStatus?.expires_at && customStatus?.duration !== CustomStatusDuration.DONT_CLEAR) {
        expiryTime = (
            <ExpiryTime
                time={customStatus.expires_at}
                timezone={props.timezone}

                // className={classNames('custom_status__expiry', {
                //     padded: customStatus?.text?.length > 0,
                // })}
                withinBrackets={true}
            />
        );
    }

    let label = <></>;

    if (customStatus?.text?.length > 0) {
        label = (
            <>
                <CustomStatusText
                    text={customStatus.text}

                    // className='custom_status__text'
                />
                {expiryTime}
            </>
        );
    } else if (customStatus?.expires_at && customStatus?.duration !== CustomStatusDuration.DONT_CLEAR) {
        label = (
            <>
                {expiryTime}
            </>
        );
    } else if (customStatus?.duration === CustomStatusDuration.DONT_CLEAR) {
        label = (
            <FormattedMessage
                id='userAccountPopover.menuItem.setCustomStatus.noStatusTextSet'
                defaultMessage='Set custom status text...'
            />
        );
    }

    return (
        <>
            <Menu.Item
                leadingElement={
                    <CustomStatusEmoji
                        showTooltip={false}
                        emojiStyle={{marginLeft: 0}}
                        emojiSize={18}
                    />
                }
                labels={label}
            />
            <Menu.Separator/>
        </>
    );
}
