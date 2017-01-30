export function getDistanceBW2Points(point1, point2, xAttr = 'x', yAttr = 'y') {
    return Math.sqrt(Math.pow(point1[xAttr] - point2[xAttr], 2) + Math.pow(point1[yAttr] - point2[yAttr], 2));
}

/**
  * Funtion to return nearest point of given pivot point.
  * It return two points one nearest and other nearest but having both coorditanes smaller than the given point's coordinates.
  */
export function getNearestPoint(pivotPoint, points, xAttr = 'x', yAttr = 'y') {
    var nearestPoint = {};
    var nearestPointLte = {};  // Nearest point smaller than or equal to point
    for (const point of points) {
        if (typeof nearestPoint[xAttr] === 'undefined' || typeof nearestPoint[yAttr] === 'undefined') {
            nearestPoint = point;
        } else if (getDistanceBW2Points(point, pivotPoint, xAttr, yAttr) < getDistanceBW2Points(nearestPoint, pivotPoint, xAttr, yAttr)) {
        // Check for bestImage
            nearestPoint = point;
        }

        if (typeof nearestPointLte[xAttr] === 'undefined' || typeof nearestPointLte[yAttr] === 'undefined') {
            if (point[xAttr] <= pivotPoint[xAttr] && point[yAttr] <= pivotPoint[yAttr]) {
                nearestPointLte = point;
            }
        } else if (
        // Check for bestImageLte
            getDistanceBW2Points(point, pivotPoint, xAttr, yAttr) < getDistanceBW2Points(nearestPointLte, pivotPoint, xAttr, yAttr) &&
            point[xAttr] <= pivotPoint[xAttr] && point[yAttr] <= pivotPoint[yAttr]
        ) {
            nearestPointLte = point;
        }
    }
    return {
        nearestPoint,
        nearestPointLte
    };
}
