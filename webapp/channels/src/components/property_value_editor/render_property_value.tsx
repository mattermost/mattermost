// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedDate} from 'react-intl';
import {useSelector} from 'react-redux';

import type {PropertyField, PropertyFieldOption} from '@mattermost/types/properties';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getUser} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import Avatar from 'components/widgets/users/avatar/avatar';

import {imageURLForUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

function getOptions(field: PropertyField): PropertyFieldOption[] {
    return (field.attrs?.options as PropertyFieldOption[] | undefined) ?? [];
}

function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) {
        return true;
    }
    if (typeof value === 'string' && value.trim() === '') {
        return true;
    }
    if (Array.isArray(value) && value.length === 0) {
        return true;
    }
    return false;
}

function OptionPill({option}: {option: PropertyFieldOption}) {
    const style: React.CSSProperties = option.color ? {backgroundColor: option.color} : {};
    return (
        <span
            className='property-pill'
            style={style}
        >
            {option.name}
        </span>
    );
}

function UserValue({userId}: {userId: string}) {
    const user = useSelector((state: GlobalState) => getUser(state, userId));
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);

    if (!user) {
        return <span className='property-user'>{userId}</span>;
    }

    const name = displayUsername(user, teammateNameDisplay);
    return (
        <span className='property-user'>
            <Avatar
                size='xxs'
                username={user.username}
                url={imageURLForUser(user.id, user.last_picture_update)}
            />
            <span className='property-user__name'>{name}</span>
        </span>
    );
}

export function renderPropertyValue(
    field: PropertyField,
    value: unknown,
): React.ReactElement | null {
    if (isEmpty(value)) {
        return null;
    }

    switch (field.type) {
    case 'text': {
        const text = typeof value === 'string' ? value.trim() : String(value);
        if (text.length === 0) {
            return null;
        }
        return <span className='property-text'>{text}</span>;
    }
    case 'date': {
        const ms = typeof value === 'string' ? Date.parse(value) : NaN;
        if (Number.isNaN(ms)) {
            return <span className='property-date'>{String(value)}</span>;
        }
        return (
            <span className='property-date'>
                <FormattedDate
                    value={ms}
                    year='numeric'
                    month='short'
                    day='2-digit'
                />
            </span>
        );
    }
    case 'select': {
        if (typeof value !== 'string') {
            return null;
        }
        const option = getOptions(field).find((opt) => opt.id === value);
        if (!option) {
            return null;
        }
        return <OptionPill option={option}/>;
    }
    case 'multiselect': {
        if (!Array.isArray(value)) {
            return null;
        }
        const options = getOptions(field);
        const selected = value.
            map((id) => options.find((opt) => opt.id === id)).
            filter((opt): opt is PropertyFieldOption => Boolean(opt));
        if (selected.length === 0) {
            return null;
        }
        return (
            <span className='property-pills'>
                {selected.map((opt) => (
                    <OptionPill
                        key={opt.id}
                        option={opt}
                    />
                ))}
            </span>
        );
    }
    case 'user': {
        if (typeof value !== 'string') {
            return null;
        }
        return <UserValue userId={value}/>;
    }
    default:
        return null;
    }
}
