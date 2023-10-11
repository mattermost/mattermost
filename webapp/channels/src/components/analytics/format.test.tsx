// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {synchronizeChartLabels, formatUsersWithPostsPerDayData} from './format';

describe('components/analytics/format.tsx', () => {
    test('should create union of all date ranges', () => {
        const data1 = [{
            name: 'date1',
            value: 1,
        }, {
            name: 'date2',
            value: 2,
        }];
        const data2 = [{
            name: 'date1',
            value: 1,
        }, {
            name: 'date3',
            value: 3,
        }];
        const data3 = [{
            name: 'date2',
            value: 2,
        }, {
            name: 'date4',
            value: 4,
        }];
        const syncData = synchronizeChartLabels(data1, data2, data3);
        expect(syncData.length).toBe(4);
    });

    test('should synchronize null data', () => {
        const labels = ['date1', 'date2', 'date3', 'date4'];
        const chartData = formatUsersWithPostsPerDayData(labels, null);
        expect(chartData.labels.length).toBe(0);
        expect(chartData.datasets[0].data.length).toBe(0);
    });

    test('should not add empty data', () => {
        const data1: any[] = [];
        const labels = ['date1', 'date2', 'date3', 'date4'];
        const chartData = formatUsersWithPostsPerDayData(labels, data1);
        expect(chartData.labels.length).toBe(0);
        expect(chartData.datasets[0].data.length).toBe(0);
    });

    test('should synchronize all date ranges', () => {
        const data1 = [{
            name: 'date2',
            value: 1,
        }, {
            name: 'date3',
            value: 2,
        }];

        const labels = ['date1', 'date2', 'date3', 'date4'];
        const chartData = formatUsersWithPostsPerDayData(labels, data1);
        expect(chartData.labels.length).toBe(4);
        expect(chartData.datasets[0].data.length).toBe(4);
        expect(chartData.datasets[0].data[0]).toBe(0);
        expect(chartData.datasets[0].data[3]).toBe(0);
    });
});
