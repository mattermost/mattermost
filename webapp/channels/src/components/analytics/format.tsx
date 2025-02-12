// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import * as Utils from 'utils/utils';

export function formatChannelDoughtnutData(totalPublic: any, totalPrivate: any) {
    const channelTypeData = {
        labels: [
            Utils.localizeMessage({id: 'analytics.system.publicChannels', defaultMessage: 'Public Channels'}),
            Utils.localizeMessage({id: 'analytics.system.privateGroups', defaultMessage: 'Private Channels'}),
        ],
        datasets: [{
            data: [totalPublic, totalPrivate],
            backgroundColor: ['#46BFBD', '#FDB45C'],
            hoverBackgroundColor: ['#5AD3D1', '#FFC870'],
        }],
    };

    return channelTypeData;
}

export function formatPostsPerDayData(labels: string[], data: any) {
    const chartData = {
        labels: [] as string[],
        datasets: [{
            fillColor: 'rgba(151,187,205,0.2)',
            borderColor: 'rgba(151,187,205,1)',
            pointBackgroundColor: 'rgba(151,187,205,1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(151,187,205,1)',
            data: [] as any,
        }],
    };
    return fillChartData(chartData, labels, data);
}

// synchronizeChartLabels converges on a uniform set of labels for all entries in the given chart data.
// If a given label wasn't already present in the chart data, a 0-valued data point at that label is added.
export function synchronizeChartLabels(...datas: any) {
    const labels: Set<string> = new Set();
    datas.forEach((data: any) => {
        if (data?.length) {
            data.forEach((e: any) => labels.add(e.name));
        }
    });
    return Array.from(labels).sort();
}

export function formatUsersWithPostsPerDayData(labels: string[], data: any) {
    const chartData = {
        labels: [] as string[],
        datasets: [{
            label: '',
            fillColor: 'rgba(151,187,205,0.2)',
            borderColor: 'rgba(151,187,205,1)',
            pointBackgroundColor: 'rgba(151,187,205,1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(151,187,205,1)',
            data: [] as any,
        }],
    };
    return fillChartData(chartData, labels, data);
}

function fillChartData(chartData: any, labels: any, data: any) {
    if (data?.length) {
        chartData.labels = labels;

        //labels are in order, add in label order...
        chartData.labels.forEach((label: string) => {
            const element = data.find((e: any) => e.name === label);
            const val = element ? element.value : 0;
            chartData.datasets[0].data.push(val);
        });
    }
    return chartData;
}
