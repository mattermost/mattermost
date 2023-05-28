// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

import React, {ElementRef, useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import PlaybooksProductIcon from 'src/components/assets/icons/playbooks_product_icon';

import {isPlaybookRunRHSOpen} from 'src/selectors';

export const ChannelHeaderButton = () => {
    const myRef = useRef<ElementRef<typeof PlaybooksProductIcon>>(null);
    const isRHSOpen = useSelector(isPlaybookRunRHSOpen);

    // If it has been mounted, we know our parent is always a button.
    const parent = myRef?.current ? myRef?.current?.parentNode as HTMLButtonElement : null;
    parent?.classList.toggle('channel-header__icon--active-inverted', isRHSOpen);

    return (
        <PlaybooksProductIcon
            id='incidentIcon'
            ref={myRef}
        />
    );
};

export const ChannelHeaderText = () => {
    return <FormattedMessage defaultMessage='Playbooks'/>;
};

export const ChannelHeaderTooltip = ChannelHeaderText;
