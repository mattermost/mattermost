"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports["default"] = getInnerHeight;
function getInnerHeight(el) {
    var clientHeight = el.clientHeight;

    var _getComputedStyle = getComputedStyle(el);

    var paddingTop = _getComputedStyle.paddingTop;
    var paddingBottom = _getComputedStyle.paddingBottom;

    return clientHeight - parseFloat(paddingTop) - parseFloat(paddingBottom);
}