// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import MentionsButton from './mentions_button';
import SavedButton from './saved_button';

import SettingsButton from './index';

import './utility_section.scss';

/**
 * UtilitySection renders the bottom section of the ProductSidebar.
 * Contains utility buttons for:
 * - Saved posts (toggles RHS panel)
 * - Recent mentions (toggles RHS panel)
 * - Settings (opens modal)
 */
export const UtilitySection = (): JSX.Element => {
    return (
        <div className='UtilitySection'>
            <SavedButton/>
            <MentionsButton/>
            <SettingsButton/>
        </div>
    );
};

export default UtilitySection;
