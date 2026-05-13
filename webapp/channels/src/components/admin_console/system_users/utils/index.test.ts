// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GuestFilter} from '@mattermost/types/reports';
import type {UserReport} from '@mattermost/types/reports';

import {ColumnNames, RoleFilters, StatusFilter} from '../constants';

import {getSortColumnForOptions, getSortDirectionForOptions, getSortableColumnValueBySortColumn, getStatusFilterOption, getRoleFilterOption, convertTableOptionsToUserReportOptions} from './index';

describe('getSortColumnForOptions', () => {
    it('should return correct sort column for email', () => {
        const result = getSortColumnForOptions(ColumnNames.email);
        expect(result.sort_column).toBe('Email');
    });

    it('should return correct sort column for createAt', () => {
        const result = getSortColumnForOptions(ColumnNames.createAt);
        expect(result.sort_column).toBe('CreateAt');
    });

    it('should default to username if no id is provided', () => {
        const result = getSortColumnForOptions();
        expect(result.sort_column).toBe('Username');
    });
});

describe('getSortDirectionForOptions', () => {
    it('should return ascending sort direction if desc is false', () => {
        const result = getSortDirectionForOptions(false);
        expect(result.sort_direction).toBe('asc');
    });

    it('should return descending sort direction if desc is true', () => {
        const result = getSortDirectionForOptions(true);
        expect(result.sort_direction).toBe('desc');
    });
});

describe('getSortableColumnValueBySortColumn', () => {
    it('should return email value when sortColumn is email', () => {
        const row = {email: 'test@example.com', id: 'testId'} as UserReport;
        const result = getSortableColumnValueBySortColumn(row, ColumnNames.email);
        expect(result).toBe('test@example.com');
    });

    it('should return create_at value as string when sortColumn is createAt', () => {
        const row = {create_at: 1234} as UserReport;
        const result = getSortableColumnValueBySortColumn(row, ColumnNames.createAt);
        expect(typeof result).toBe('string');
        expect(result).toBe('1234');
    });

    it('should return username value by default', () => {
        const row = {username: 'testuser', id: 'testId', create_at: 22122} as UserReport;
        const result = getSortableColumnValueBySortColumn(row, 'someOtherColumn');
        expect(result).toBe('testuser');
    });
});

describe('getStatusFilterOption', () => {
    it('should return hide_inactive true for Active status', () => {
        const result = getStatusFilterOption(StatusFilter.Active);
        expect(result).toEqual({hide_inactive: true});
    });

    it('should return hide_active true for Deactivated status', () => {
        const result = getStatusFilterOption(StatusFilter.Deactivated);
        expect(result).toEqual({hide_active: true});
    });

    it('should return an empty object for other status', () => {
        const result = getStatusFilterOption('SomeOtherStatus' as any);
        expect(result).toEqual({});
    });
});

describe('getRoleFilterOption', () => {
    it('should return undefined for both when role is Any', () => {
        const result = getRoleFilterOption(RoleFilters.Any);
        expect(result).toEqual({role_filter: undefined, guest_filter: undefined});
    });

    it('should return undefined for both when role is not provided', () => {
        const result = getRoleFilterOption();
        expect(result).toEqual({role_filter: undefined, guest_filter: undefined});
    });

    it('should return role_filter for Admin', () => {
        const result = getRoleFilterOption(RoleFilters.Admin);
        expect(result).toEqual({role_filter: 'system_admin', guest_filter: undefined});
    });

    it('should return role_filter for Member', () => {
        const result = getRoleFilterOption(RoleFilters.Member);
        expect(result).toEqual({role_filter: 'system_user', guest_filter: undefined});
    });

    it('should return guest_filter all for GuestAll', () => {
        const result = getRoleFilterOption(RoleFilters.GuestAll);
        expect(result).toEqual({role_filter: undefined, guest_filter: GuestFilter.All});
    });

    it('should return guest_filter single_channel for GuestSingleChannel', () => {
        const result = getRoleFilterOption(RoleFilters.GuestSingleChannel);
        expect(result).toEqual({role_filter: undefined, guest_filter: GuestFilter.SingleChannel});
    });

    it('should return guest_filter multi_channel for GuestMultiChannel', () => {
        const result = getRoleFilterOption(RoleFilters.GuestMultiChannel);
        expect(result).toEqual({role_filter: undefined, guest_filter: GuestFilter.MultipleChannel});
    });
});

describe('convertTableOptionsToUserReportOptions', () => {
    it('should set guest_filter and not role_filter when filterRole is GuestSingleChannel', () => {
        const result = convertTableOptionsToUserReportOptions({filterRole: RoleFilters.GuestSingleChannel});
        expect(result.guest_filter).toBe(GuestFilter.SingleChannel);
        expect(result.role_filter).toBeUndefined();
    });

    it('should set guest_filter and not role_filter when filterRole is GuestMultiChannel', () => {
        const result = convertTableOptionsToUserReportOptions({filterRole: RoleFilters.GuestMultiChannel});
        expect(result.guest_filter).toBe(GuestFilter.MultipleChannel);
        expect(result.role_filter).toBeUndefined();
    });

    it('should set guest_filter and not role_filter when filterRole is GuestAll', () => {
        const result = convertTableOptionsToUserReportOptions({filterRole: RoleFilters.GuestAll});
        expect(result.guest_filter).toBe(GuestFilter.All);
        expect(result.role_filter).toBeUndefined();
    });

    it('should set role_filter and not guest_filter when filterRole is Admin', () => {
        const result = convertTableOptionsToUserReportOptions({filterRole: RoleFilters.Admin});
        expect(result.role_filter).toBe('system_admin');
        expect(result.guest_filter).toBeUndefined();
    });

    it('should not set role_filter or guest_filter when filterRole is Any', () => {
        const result = convertTableOptionsToUserReportOptions({filterRole: RoleFilters.Any});
        expect(result.role_filter).toBeUndefined();
        expect(result.guest_filter).toBeUndefined();
    });
});
