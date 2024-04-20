// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';

import SettingItemMin from 'components/setting_item_min';
import type SettingItemMinComponent from 'components/setting_item_min';

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

    /**
     * Replacement in place of edit button when the setting (in collapsed mode) is disabled
     */
    collapsedEditButtonWhenDisabled?: ReactNode;
}

const SettingItem = ({
    active,
    areAllSectionsInactive,
    max,
    title,
    updateSection,
    describe,
    section,
    isDisabled,
    collapsedEditButtonWhenDisabled,
}: Props) => {
    const minRef = useRef<SettingItemMinComponent>(null);

    useEffect(() => {
        if (!active && prevActive.current && areAllSectionsInactive) {
            minRef.current?.focus();
        }
        prevActive.current = active;
    }, [active, areAllSectionsInactive]);

    const prevActive = useRef<boolean>(active);

    if (active) {
        return max;
    }

    return (
        <SettingItemMin
            ref={minRef}
            title={title}
            updateSection={updateSection}
            describe={describe}
            section={section}
            isDisabled={isDisabled}
            collapsedEditButtonWhenDisabled={collapsedEditButtonWhenDisabled}
        />
    );
};

export default SettingItem;
