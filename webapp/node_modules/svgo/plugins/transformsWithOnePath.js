'use strict';

/*
 * Thanks to http://fontello.com project for sponsoring this plugin
 */

exports.type = 'full';

exports.active = false;

exports.description = 'performs a set of operations on SVG with one path inside (disabled by default)';

exports.params = {
    // width and height to resize SVG and rescale inner Path
    width: false,
    height: false,

    // scale inner Path without resizing SVG
    scale: false,

    // shiftX/Y inner Path
    shiftX: false,
    shiftY: false,

    // crop SVG width along the real width of inner Path
    hcrop: false,

    // vertical center inner Path inside SVG height
    vcenter: false,

    // stringify params
    floatPrecision: 3,
    leadingZero: true,
    negativeExtraSpace: true
};

var _path = require('./_path.js'),
    relative2absolute = _path.relative2absolute,
    computeCubicBoundingBox = _path.computeCubicBoundingBox,
    computeQuadraticBoundingBox = _path.computeQuadraticBoundingBox,
    applyTransforms = _path.applyTransforms,
    js2path = _path.js2path,
    path2js = _path.path2js,
    EXTEND = require('whet.extend');

exports.fn = function(data, params) {

    data.content.forEach(function(item) {

        // only for SVG with one Path inside
        if (item.isElem('svg') &&
            item.content.length === 1 &&
            item.content[0].isElem('path')
        ) {

            var svgElem = item,
                pathElem = svgElem.content[0],
                // get absoluted Path data
                path = relative2absolute(EXTEND(true, [], path2js(pathElem))),
                xs = [],
                ys = [],
                cubicСontrolPoint = [0, 0],
                quadraticСontrolPoint = [0, 0],
                lastPoint = [0, 0],
                cubicBoundingBox,
                quadraticBoundingBox,
                i,
                segment;

            path.forEach(function(pathItem) {

                // ML
                if ('ML'.indexOf(pathItem.instruction) > -1) {

                    for (i = 0; i < pathItem.data.length; i++) {
                        if (i % 2 === 0) {
                            xs.push(pathItem.data[i]);
                        } else {
                            ys.push(pathItem.data[i]);
                        }
                    }

                    lastPoint = cubicСontrolPoint = quadraticСontrolPoint = pathItem.data.slice(-2);

                // H
                } else if (pathItem.instruction === 'H') {

                    pathItem.data.forEach(function(d) {
                        xs.push(d);
                    });

                    lastPoint[0] = cubicСontrolPoint[0] = quadraticСontrolPoint[0] = pathItem.data[pathItem.data.length - 2];

                // V
                } else if (pathItem.instruction === 'V') {

                    pathItem.data.forEach(function(d) {
                        ys.push(d);
                    });

                    lastPoint[1] = cubicСontrolPoint[1] = quadraticСontrolPoint[1] = pathItem.data[pathItem.data.length - 1];

                // C
                } else if (pathItem.instruction === 'C') {

                    for (i = 0; i < pathItem.data.length; i += 6) {

                        segment = pathItem.data.slice(i, i + 6);

                        cubicBoundingBox = computeCubicBoundingBox.apply(this, lastPoint.concat(segment));

                        xs.push(cubicBoundingBox.minx);
                        xs.push(cubicBoundingBox.maxx);

                        ys.push(cubicBoundingBox.miny);
                        ys.push(cubicBoundingBox.maxy);

                        // reflected control point for the next possible S
                        cubicСontrolPoint = [
                            2 * segment[4] - segment[2],
                            2 * segment[5] - segment[3]
                        ];

                        lastPoint = segment.slice(-2);

                    }

                // S
                } else if (pathItem.instruction === 'S') {

                    for (i = 0; i < pathItem.data.length; i += 4) {

                        segment = pathItem.data.slice(i, i + 4);

                        cubicBoundingBox = computeCubicBoundingBox.apply(this, lastPoint.concat(cubicСontrolPoint).concat(segment));

                        xs.push(cubicBoundingBox.minx);
                        xs.push(cubicBoundingBox.maxx);

                        ys.push(cubicBoundingBox.miny);
                        ys.push(cubicBoundingBox.maxy);

                        // reflected control point for the next possible S
                        cubicСontrolPoint = [
                            2 * segment[2] - cubicСontrolPoint[0],
                            2 * segment[3] - cubicСontrolPoint[1],
                        ];

                        lastPoint = segment.slice(-2);

                    }

                // Q
                } else if (pathItem.instruction === 'Q') {

                    for (i = 0; i < pathItem.data.length; i += 4) {

                        segment = pathItem.data.slice(i, i + 4);

                        quadraticBoundingBox = computeQuadraticBoundingBox.apply(this, lastPoint.concat(segment));

                        xs.push(quadraticBoundingBox.minx);
                        xs.push(quadraticBoundingBox.maxx);

                        ys.push(quadraticBoundingBox.miny);
                        ys.push(quadraticBoundingBox.maxy);

                        // reflected control point for the next possible T
                        quadraticСontrolPoint = [
                            2 * segment[2] - segment[0],
                            2 * segment[3] - segment[1]
                        ];

                        lastPoint = segment.slice(-2);

                    }

                // S
                } else if (pathItem.instruction === 'T') {

                    for (i = 0; i < pathItem.data.length; i += 2) {

                        segment = pathItem.data.slice(i, i + 2);

                        quadraticBoundingBox = computeQuadraticBoundingBox.apply(this, lastPoint.concat(quadraticСontrolPoint).concat(segment));

                        xs.push(quadraticBoundingBox.minx);
                        xs.push(quadraticBoundingBox.maxx);

                        ys.push(quadraticBoundingBox.miny);
                        ys.push(quadraticBoundingBox.maxy);

                        // reflected control point for the next possible T
                        quadraticСontrolPoint = [
                            2 * segment[0] - quadraticСontrolPoint[0],
                            2 * segment[1] - quadraticСontrolPoint[1]
                        ];

                        lastPoint = segment.slice(-2);

                    }

                }

            });

            var xmin = Math.min.apply(this, xs).toFixed(params.floatPrecision),
                xmax = Math.max.apply(this, xs).toFixed(params.floatPrecision),
                ymin = Math.min.apply(this, ys).toFixed(params.floatPrecision),
                ymax = Math.max.apply(this, ys).toFixed(params.floatPrecision),
                svgWidth = +svgElem.attr('width').value,
                svgHeight = +svgElem.attr('height').value,
                realWidth = Math.round(xmax - xmin),
                realHeight = Math.round(ymax - ymin),
                transform = '',
                scale;

            // width & height
            if (params.width && params.height) {

                scale = Math.min(params.width / svgWidth, params.height / svgHeight);

                realWidth = realWidth * scale;
                realHeight = realHeight * scale;

                svgWidth = svgElem.attr('width').value = params.width;
                svgHeight = svgElem.attr('height').value = params.height;

                transform += ' scale(' + scale + ')';

            // width
            } else if (params.width && !params.height) {

                scale = params.width / svgWidth;

                realWidth = realWidth * scale;
                realHeight = realHeight * scale;

                svgWidth = svgElem.attr('width').value = params.width;
                svgHeight = svgElem.attr('height').value = svgHeight * scale;

                transform += ' scale(' + scale + ')';

            // height
            } else if (params.height && !params.width) {

                scale = params.height / svgHeight;

                realWidth = realWidth * scale;
                realHeight = realHeight * scale;

                svgWidth = svgElem.attr('width').value = svgWidth * scale;
                svgHeight = svgElem.attr('height').value = params.height;

                transform += ' scale(' + scale + ')';

            }

            // shiftX
            if (params.shiftX) {
                transform += ' translate(' + realWidth * params.shiftX + ', 0)';
            }

            // shiftY
            if (params.shiftY) {
                transform += ' translate(0, ' + realHeight * params.shiftY + ')';
            }

            // scale
            if (params.scale) {
                scale = params.scale;

                var shiftX = svgWidth / 2,
                    shiftY = svgHeight / 2;

                realWidth = realWidth * scale;
                realHeight = realHeight * scale;

                if (params.shiftX || params.shiftY) {
                    transform += ' scale(' + scale + ')';
                } else {
                    transform += ' translate(' + shiftX + ' ' + shiftY + ') scale(' + scale + ') translate(-' + shiftX + ' -' + shiftY + ')';
                }
            }

            // hcrop
            if (params.hcrop) {
                transform += ' translate(' + (-xmin) + ' 0)';

                svgElem.attr('width').value = realWidth;
            }

            // vcenter
            if (params.vcenter) {
                transform += ' translate(0 ' + (((svgHeight - realHeight) / 2) - ymin) + ')';
            }

            if (transform) {
                pathElem.addAttr({
                    name: 'transform',
                    prefix: '',
                    local: 'transform',
                    value: transform
                });

                path = applyTransforms(pathElem, pathElem.pathJS, true, params.floatPrecision);

                // transformed data rounding
                path.forEach(function(pathItem) {
                    if (pathItem.data) {
                        pathItem.data = pathItem.data.map(function(num) {
                            return +num.toFixed(params.floatPrecision);
                        });
                    }
                });

                // save new
                js2path(pathElem, path, params);
            }

        }

    });

    return data;

};
