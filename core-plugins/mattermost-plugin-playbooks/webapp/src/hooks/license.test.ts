// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {renderHook} from '@testing-library/react-hooks';
import * as redux from 'react-redux';

import * as license from 'src/license';

import {
    useAllowAddMessageToTimelineInCurrentTeam,
    useAllowChannelExport,
    useAllowConditionalPlaybooks,
    useAllowMakePlaybookPrivate,
    useAllowPlaybookAndRunMetrics,
    useAllowPlaybookAttributes,
    useAllowPlaybookStatsView,
    useAllowPrivatePlaybooks,
    useAllowRequestUpdate,
    useAllowRetrospectiveAccess,
    useAllowSetTaskDueDate,
} from './license';

describe('License Hooks', () => {
    let useSelectorSpy: jest.SpyInstance;
    let isProfessionalLicensedOrDevelopmentSpy: jest.SpyInstance;
    let isEnterpriseLicensedOrDevelopmentSpy: jest.SpyInstance;

    beforeEach(() => {
        useSelectorSpy = jest.spyOn(redux, 'useSelector');
        isProfessionalLicensedOrDevelopmentSpy = jest.spyOn(license, 'isProfessionalLicensedOrDevelopment');
        isEnterpriseLicensedOrDevelopmentSpy = jest.spyOn(license, 'isEnterpriseLicensedOrDevelopment');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('Professional license hooks', () => {
        it('useAllowAddMessageToTimelineInCurrentTeam returns professional license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isProfessionalLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowAddMessageToTimelineInCurrentTeam());

            expect(result.current).toBe(true);
        });

        it('useAllowRetrospectiveAccess returns professional license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isProfessionalLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowRetrospectiveAccess());

            expect(result.current).toBe(true);
        });

        it('useAllowSetTaskDueDate returns professional license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isProfessionalLicensedOrDevelopmentSpy.mockReturnValue(false);

            const {result} = renderHook(() => useAllowSetTaskDueDate());

            expect(result.current).toBe(false);
        });

        it('useAllowRequestUpdate returns professional license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isProfessionalLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowRequestUpdate());

            expect(result.current).toBe(true);
        });
    });

    describe('Enterprise license hooks', () => {
        it('useAllowChannelExport returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowChannelExport());

            expect(result.current).toBe(true);
        });

        it('useAllowPlaybookStatsView returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(false);

            const {result} = renderHook(() => useAllowPlaybookStatsView());

            expect(result.current).toBe(false);
        });

        it('useAllowPlaybookAndRunMetrics returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowPlaybookAndRunMetrics());

            expect(result.current).toBe(true);
        });

        it('useAllowPrivatePlaybooks returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(false);

            const {result} = renderHook(() => useAllowPrivatePlaybooks());

            expect(result.current).toBe(false);
        });

        it('useAllowMakePlaybookPrivate returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowMakePlaybookPrivate());

            expect(result.current).toBe(true);
        });

        it('useAllowPlaybookAttributes returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowPlaybookAttributes());

            expect(result.current).toBe(true);
        });

        it('useAllowConditionalPlaybooks returns enterprise license status', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(true);

            const {result} = renderHook(() => useAllowConditionalPlaybooks());

            expect(result.current).toBe(true);
        });

        it('useAllowConditionalPlaybooks returns false when unlicensed', () => {
            useSelectorSpy.mockImplementation((selector) => selector());
            isEnterpriseLicensedOrDevelopmentSpy.mockReturnValue(false);

            const {result} = renderHook(() => useAllowConditionalPlaybooks());

            expect(result.current).toBe(false);
        });
    });
});
