// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages} from 'react-intl';
import {useSelector} from 'react-redux';

import {GuestTag as PureGuestTag} from '@mattermost/design-system';
import type {TagSize} from '@mattermost/design-system';

import {shouldHideGuestTags} from './selectors';

// Define messages to prevent removal during i18n cleanup
defineMessages({
    beta: {
        id: 'tag.default.beta',
        defaultMessage: 'BETA',
    },
    bot: {
        id: 'tag.default.bot',
        defaultMessage: 'BOT',
    },
    guest: {
        id: 'tag.default.guest',
        defaultMessage: 'GUEST',
    },
});

interface GuestTagProps {
    className?: string;
    size?: TagSize;
}

/**
 * Redux-connected wrapper for GuestTag that automatically reads
 * the HideGuestTags config from the store.
 */
const GuestTag: React.FC<GuestTagProps> = (props) => {
    const hide = useSelector(shouldHideGuestTags);

    return (
        <PureGuestTag
            {...props}
            hide={hide}
        />
    );
};

export default GuestTag;
