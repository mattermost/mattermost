// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MouseEvent, KeyboardEvent} from 'react';
import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import * as Menu from 'components/menu';
import EmojiIcon from 'components/widgets/icons/emoji_icon';

interface Props {
    openCustomStatusModal: (event: MouseEvent<HTMLLIElement> | KeyboardEvent<HTMLLIElement>) => void;
}

export default function UserAccountSetCustomStatusMenuItem(props: Props) {
    const {formatMessage} = useIntl();

    return (
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
    );
}
