// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedList} from 'react-intl';
import {useSelector} from 'react-redux';

import type {PropertyField, PropertyValue} from '@mattermost/types/properties';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {useUser} from 'components/common/hooks/useUser';
import PropertyValueRenderer from 'components/properties_card_view/propertyValueRenderer/propertyValueRenderer';
import {hasSpecialisedTextRenderer, textSubtype} from 'components/properties_card_view/propertyValueRenderer/renderable';

import {resolveOptionChips} from 'utils/property_options';

import {usePropertyValueMetadata} from './use_property_value_metadata';
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

    case 'text':
        return (
            <TextSubtype
                field={field}
                value={value}
            />
        );

    case 'user':
        return <UserName userId={String(value.value)}/>;

    case 'multiuser':
        return <MultiUserNames value={value}/>;

    default:
        return null;
    }
}

/**
 * A `text` field's value, by subtype.
 *
 * The plain subtype is the stored string. Every other subtype stores an
 * *identifier* — a post, channel, team or timestamp — so it goes through the
 * renderer that knows how to turn that id into something readable, rather than
 * printing the id. `PropertyValueRenderer` already owns that mapping; going
 * through it is what stops this file growing a second copy that can disagree.
 *
 * An unrecognised subtype falls back to the stored string, so a subtype added
 * server-side before this client knows about it degrades to its raw value
 * instead of blanking the row.
 */
function TextSubtype({field, value}: Props) {
    const metadata = usePropertyValueMetadata(field, value);

    if (!hasSpecialisedTextRenderer(textSubtype(field))) {
        return <>{String(value.value)}</>;
    }

    return (
        <PropertyValueRenderer
            field={field}
            value={value}
            metadata={metadata}
        />
    );
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
