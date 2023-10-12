// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef, type ReactNode} from 'react';

import SettingItemMin from 'components/setting_item_min';

import {a11yFocus} from 'utils/utils';

type Props = {

    /**
     * Whether this setting item is currently open
     */
    active: boolean;

    /**
     * Whether all sections in the panel are currently closed
     */
    areAllSectionsInactive: boolean;

    /**
     * The identifier of this section
     */
    section: string;

    /**
     * The setting UI when it is maximized (open)
     */
    max: ReactNode;

    // Props to pass through for SettingItemMin
    updateSection: (section: string) => void;
    title?: ReactNode;
    isDisabled?: boolean;
    describe?: ReactNode;
};

function SettingItem({
    section = '',
    title,
    updateSection,
    describe,
    isDisabled,
    active,
    areAllSectionsInactive,
    max,
}: Props) {
    const editButtonRef = useRef<HTMLButtonElement>(null);
    const previouslyActive = useRef<boolean>(active);

    useEffect(() => {
        // console.log('SettingItem: useEffect: active: ', active, editButtonRef.current);

        // We want to bring back focus to the edit button when the section is closed and all sections are closed
        // since we need to know if the section was previously active, we are using a ref to store the previous value
        if (previouslyActive.current && !active && areAllSectionsInactive) {
            editButtonRef.current?.focus();
            a11yFocus(editButtonRef.current);
        }

        previouslyActive.current = active;
    }, [active, areAllSectionsInactive]);

    if (active) {
        return (
            <>
                {max}
            </>
        );
    }

    return (
        <SettingItemMin
            ref={editButtonRef}
            title={title}
            updateSection={updateSection}
            describe={describe}
            section={section}
            isDisabled={isDisabled}
        />
    );
}

export default SettingItem;
