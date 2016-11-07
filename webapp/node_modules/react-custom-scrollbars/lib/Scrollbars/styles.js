'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
var containerStyleDefault = exports.containerStyleDefault = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    height: '100%'
};

// Overrides containerStyleDefault properties
var containerStyleAutoHeight = exports.containerStyleAutoHeight = {
    height: 'auto'
};

var viewStyleDefault = exports.viewStyleDefault = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'scroll',
    WebkitOverflowScrolling: 'touch'
};

// Overrides viewStyleDefault properties
var viewStyleAutoHeight = exports.viewStyleAutoHeight = {
    position: 'relative',
    top: undefined,
    left: undefined,
    right: undefined,
    bottom: undefined
};

var viewStyleUniversalInitial = exports.viewStyleUniversalInitial = {
    overflow: 'hidden',
    marginRight: 0,
    marginBottom: 0
};

var trackHorizontalStyleDefault = exports.trackHorizontalStyleDefault = {
    position: 'absolute',
    height: 6
};

var trackVerticalStyleDefault = exports.trackVerticalStyleDefault = {
    position: 'absolute',
    width: 6
};

var thumbHorizontalStyleDefault = exports.thumbHorizontalStyleDefault = {
    position: 'relative',
    display: 'block',
    height: '100%'
};

var thumbVerticalStyleDefault = exports.thumbVerticalStyleDefault = {
    position: 'relative',
    display: 'block',
    width: '100%'
};

var disableSelectStyle = exports.disableSelectStyle = {
    userSelect: 'none'
};

var disableSelectStyleReset = exports.disableSelectStyleReset = {
    userSelect: ''
};