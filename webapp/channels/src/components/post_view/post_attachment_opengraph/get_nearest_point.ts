// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type Point = {
    height: number;
    width: number;
};

type PartialPoint = Partial<Point>;

function isPointDefined(point: PartialPoint): point is Point {
    return point.height !== undefined && point.width !== undefined;
}

export function getDistanceBW2Points(point1: Point, point2: Point) {
    return Math.sqrt(Math.pow(point1.width - point2.width, 2) + Math.pow(point1.height - point2.height, 2));
}

/**
 * Funtion to return nearest point of given pivot point.
 * It return two points one nearest and other nearest but having both coorditanes smaller than the given point's coordinates.
 */
export function getNearestPoint<T extends PartialPoint>(pivot: Point, points: T[]): T {
    return points.reduce((nearest, point) => {
        if (isPointDefined(nearest) && isPointDefined(point) &&
            getDistanceBW2Points(point, pivot) >= getDistanceBW2Points(nearest, pivot)) {
            return nearest;
        }
        return point;
    }, {} as T);
}
