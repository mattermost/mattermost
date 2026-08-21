// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import StarterLeftPanel from './starter_left_panel';
import type {StarterEditionProps} from './starter_left_panel';

describe('components/admin_console/license_settings/starter_edition/starter_left_panel', () => {
    const baseProps: StarterEditionProps = {
        openEELicenseModal: jest.fn(),
        currentPlan: <div>{'Current Plan'}</div>,
        upgradedFromTE: false,
        fileInputRef: React.createRef(),
        handleChange: jest.fn(),
        isLicenseSetByEnvVar: false,
    };

    test('should enable upload button when license is not set by env var', () => {
        renderWithContext(
            <StarterLeftPanel
                {...baseProps}
            />,
        );

        expect(screen.getByRole('button', {name: /Upload File/i})).toBeEnabled();
    });

    test('should disable upload button when license is set by env var', () => {
        renderWithContext(
            <StarterLeftPanel
                {...baseProps}
                isLicenseSetByEnvVar={true}
            />,
        );

        expect(screen.getByRole('button', {name: /Upload File/i})).toBeDisabled();
    });
});
