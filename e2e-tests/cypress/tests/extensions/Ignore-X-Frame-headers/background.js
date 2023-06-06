/* eslint-disable header/header */

// taken from https://github.com/guilryder/chrome-extensions/tree/master/xframe_ignore

/*global chrome*/

var HEADERS_TO_STRIP_LOWERCASE = [
    'content-security-policy',
    'x-frame-options',
];

chrome.webRequest.onHeadersReceived.addListener(
    (details) => {
        return {
            responseHeaders: details.responseHeaders.filter((header) => {
                return HEADERS_TO_STRIP_LOWERCASE.indexOf(header.name.toLowerCase()) < 0;
            }),
        };
    }, {
        urls: ['<all_urls>'],
    }, ['blocking', 'responseHeaders']);
