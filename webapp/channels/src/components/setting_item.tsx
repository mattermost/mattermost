// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ReactNode} from 'react';
import React, {useRef} from 'react';

import type SettingItemMinComponent from 'components/setting_item_min';
import SettingItemMin from 'components/setting_item_min';

import useDidUpdate from './common/hooks/useDidUpdate';

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
    max?: ReactNode;

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
    section,
    max,
    updateSection,
    title,
    isDisabled,
    describe,
    collapsedEditButtonWhenDisabled,
}: Props) => {
    const minRef = useRef<SettingItemMinComponent>(null);

    useDidUpdate(() => {
        // We want to bring back focus to the edit button when the section is opened and then closed along with all sections are closed

        if (!active && areAllSectionsInactive) {
            minRef.current?.focus();
        }
    }, [active]);

    if (active) {
        return <>{max}</>;
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

export default React.memo(SettingItem);
