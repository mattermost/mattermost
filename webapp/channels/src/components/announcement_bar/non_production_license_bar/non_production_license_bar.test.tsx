// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext} from 'tests/react_testing_utils';

import NonProductionLicenseAnnouncementBar from './index';

describe('components/announcement_bar/NonProductionLicenseAnnouncementBar', () => {
    const initialState = {
        entities: {
            general: {
                license: {
                    IsLicensed: 'true',
                    IsNonProduction: 'true',
                },
            },
        },
    };

    it('should show banner when license is non-production', () => {
        const {container} = renderWithContext(
            <NonProductionLicenseAnnouncementBar/>,
            initialState,
        );

        expect(container.querySelector('.announcement-bar')).not.toBeNull();
        expect(container.textContent).toContain('Developer key — not for use in production environments.');
    });

    it('should not show banner when license is not non-production', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        state.entities.general.license.IsNonProduction = 'false';

        const {container} = renderWithContext(
            <NonProductionLicenseAnnouncementBar/>,
            state,
        );

        expect(container.querySelector('.announcement-bar')).toBeNull();
    });

    it('should not show banner when the flag is absent from the license', () => {
        const state = JSON.parse(JSON.stringify(initialState));
        delete state.entities.general.license.IsNonProduction;

        const {container} = renderWithContext(
            <NonProductionLicenseAnnouncementBar/>,
            state,
        );

        expect(container.querySelector('.announcement-bar')).toBeNull();
    });

    it('should not be dismissable', () => {
        const {container} = renderWithContext(
            <NonProductionLicenseAnnouncementBar/>,
            initialState,
        );

        expect(container.querySelector('.announcement-bar__close')).toBeNull();
    });

    it('should have advisor type', () => {
        const {container} = renderWithContext(
            <NonProductionLicenseAnnouncementBar/>,
            initialState,
        );

        expect(container.querySelector('.announcement-bar.announcement-bar-advisor')).not.toBeNull();
    });
});
