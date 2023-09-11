// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import messageHtmlToComponent from 'utils/message_html_to_component';

import './export';

jest.mock('utils/message_html_to_component');

describe('messageHtmlToComponent wrapper', () => {
    const message = 'test';
    const options = {emoji: true, images: false};
    const isRHS = false;

    test('should call messageHtmlToComponent properly with only message', () => {
        window.PostUtils.messageHtmlToComponent(message);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, undefined);
    });

    test('should call messageHtmlToComponent properly with message and options', () => {
        window.PostUtils.messageHtmlToComponent(message, options);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, options);
    });

    test('should call messageHtmlToComponent properly with only message when deprecated isRHS parameter is passed', () => {
        window.PostUtils.messageHtmlToComponent(message, isRHS);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, undefined);
    });

    test('should call messageHtmlToComponent properly with message and options when deprecated isRHS parameter is passed', () => {
        window.PostUtils.messageHtmlToComponent(message, isRHS, options);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, options);
    });
});
