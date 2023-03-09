// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getNearestPoint} from './get_nearest_point';

describe('getNearestPoint', () => {
    test('should return nearest point', () => {
        for (const data of [
            {
                points: [
                    {width: 30, height: 40},
                    {width: 50, height: 50},
                    {width: 100, height: 2},
                    {width: 500, height: 200},
                    {width: 110, height: 20},
                    {width: 10, height: 20},
                ],
                pivotPoint: {width: 10, height: 20},
                nearestPoint: {width: 10, height: 20},
                nearestPointLte: {width: 10, height: 20},
            },
            {
                points: [
                    {width: 50, height: 50},
                    {width: 100, height: 2},
                    {width: 500, height: 200},
                    {width: 110, height: 20},
                    {width: 100, height: 90},
                    {width: 30, height: 40},
                ],
                pivotPoint: {width: 10, height: 20},
                nearestPoint: {width: 30, height: 40},
                nearestPointLte: {},
            },
            {
                points: [
                    {width: 50, height: 50},
                    {width: 1, height: 1},
                    {width: 15, height: 25},
                    {width: 100, height: 2},
                    {width: 500, height: 200},
                    {width: 110, height: 20},
                ],
                pivotPoint: {width: 10, height: 20},
                nearestPoint: {width: 15, height: 25},
                nearestPointLte: {width: 1, height: 1},
            },
        ]) {
            const nearestPoint = getNearestPoint(data.pivotPoint, data.points);

            expect(nearestPoint.width).toEqual(data.nearestPoint.width);
            expect(nearestPoint.height).toEqual(data.nearestPoint.height);
        }
    });
});
