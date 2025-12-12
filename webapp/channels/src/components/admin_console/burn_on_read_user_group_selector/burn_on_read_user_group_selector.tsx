// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Setting from 'components/admin_console/setting';

import {UserSelector} from '../content_flagging/user_multiselector/user_multiselector';

type Props = {
    id: string;
    label: React.ReactNode;
    helpText: React.ReactNode;
    value?: string | string[];
    onChange: (id: string, value: string) => void;
    disabled?: boolean;
    setByEnv?: boolean;
};

const BurnOnReadUserGroupSelector: React.FC<Props> = ({
    id,
    label,
    helpText,
    value,
    onChange,
    disabled = false,
    setByEnv = false,
}) => {
    // Parse value - can be string (comma-separated) or string array
    // Content flagging UserSelector expects array of user IDs
    const parsedValue = React.useMemo(() => {
        if (!value) {
            return [];
        }
        if (typeof value === 'string') {
            return value.split(',').filter(Boolean);
        }
        return value;
    }, [value]);

    // Handle onChange from UserSelector
    // UserSelector passes array of user IDs, we need to convert to comma-separated string
    const handleChange = React.useCallback((selectedUserIds: string[]) => {
        const stringValue = selectedUserIds.join(',');
        onChange(id, stringValue);
    }, [onChange, id]);

    return (
        <Setting
            label={label}
            helpText={helpText}
            inputId={id}
            setByEnv={setByEnv}
        >
            <UserSelector
                id={id}
                isMulti={true}
                multiSelectInitialValue={parsedValue}
                multiSelectOnChange={handleChange}
                placeholder='Start typing to search for users, groups, and teams...'
                enableGroups={true}
                enableTeams={true}
                disabled={disabled}
            />
        </Setting>
    );
};

export default BurnOnReadUserGroupSelector;
