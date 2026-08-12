// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {MouseEvent} from 'react';
import React from 'react';
import {FormattedMessage} from 'react-intl';

import * as Menu from 'components/menu';
import EmojiIcon from 'components/widgets/icons/emoji_icon';

interface Props {
    openCustomStatusModal: (event: MouseEvent<HTMLLIElement>) => void;
}

export default function UserAccountSetCustomStatusMenuItem(props: Props) {
    return (
        <Menu.Item
            className='userAccountMenu_setCustomStatusMenuItem'
            leadingElement={
                <EmojiIcon
                    className='userAccountMenu_setCustomStatusMenuItem_icon'
                    aria-hidden='true'
                />
            }
            labels={
                <FormattedMessage
                    id='userAccountMenu.setCustomStatusMenuItem.noStatusSet'
                    defaultMessage='Set custom status'
                />
            }
            aria-haspopup={true}
            onClick={props.openCustomStatusModal}
        />
    );
}
