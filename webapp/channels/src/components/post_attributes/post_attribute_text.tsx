// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedList} from 'react-intl';
import {useSelector} from 'react-redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {useUser} from 'components/common/hooks/useUser';

import {resolveOptionChips} from 'utils/property_options';

import {storedEntries} from './utils';

type Props = {
    field: PropertyField;
    value: PropertyValue<unknown>;
};

/**
 * A post attribute's value as plain text.
 *
 * Multi-valued fields join through `FormattedList` — react-intl's wrapper
 * around `Intl.ListFormat` — never a hardcoded `', '`: Japanese separates with
 * U+3001, and RTL locales differ in both the separator and the direction the
 * list reads in.
 */
export default function PostAttributeText({field, value}: Props) {
    switch (field.type) {
    // Resolved through the helper the chip row counts with (`chipCount`), so
    // the card and the row cannot disagree about which option a stored value
    // names, or about whether a value whose option was deleted counts at all.
    case 'select':
    case 'multiselect':
    case 'rank':
        return <FormattedList value={resolveOptionChips(field, value.value).map((chip) => chip.label)}/>;

    // Only the plain subtype. The others (`post`, `channel`, `team`,
    // `timestamp`) store an identifier rather than the text to show, so
    // `String(value.value)` would print the identifier.
    case 'text':
        return (field.attrs?.subType ?? 'text') === 'text' ? <>{String(value.value)}</> : null;

    case 'user':
        return <UserName userId={String(value.value)}/>;

    case 'multiuser':
        return <MultiUserNames value={value}/>;

    default:
        return null;
    }
}

/**
 * A user's display name and nothing else — no avatar, no profile popover
 * trigger.
 *
 * `useFallbackUsername: false` suppresses `displayUsername`'s "Someone", so a
 * profile that has not arrived yet renders nothing rather than a placeholder
 * name the post does not carry. `useUser` has already asked for it.
 */
function UserName({userId}: {userId: string}) {
    const user = useUser(userId);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);

    return <>{displayUsername(user, teammateNameDisplay, false)}</>;
}

function MultiUserNames({value}: {value: PropertyValue<unknown>}) {
    const userIds = storedEntries(value);

    // Each name needs its own `useUser`, so the entries handed to
    // `FormattedList` are components rather than strings. react-intl
    // substitutes them back into the formatted parts, which keeps the
    // separators locale-correct without this component knowing the names.
    return (
        <FormattedList
            value={userIds.map((userId, index) => (
                <UserName
                    key={`${userId}-${index}`}
                    userId={userId}
                />
            ))}
        />
    );
}
