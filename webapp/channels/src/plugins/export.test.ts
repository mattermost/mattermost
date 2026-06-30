// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import messageHtmlToComponent from 'utils/message_html_to_component';

import './export';

jest.mock('utils/message_html_to_component');

describe('window.Components exposes plugin modals', () => {
    test('EditChannelHeaderModal is defined', () => {
        expect((window as any).Components.EditChannelHeaderModal).toBeDefined();
    });

    test('ChannelNotificationsModal is defined', () => {
        expect((window as any).Components.ChannelNotificationsModal).toBeDefined();
    });
});

describe('window.WebappUtils.channels exposes channel actions', () => {
    test('favoriteChannel is defined', () => {
        expect((window as any).WebappUtils.channels.favoriteChannel).toBeDefined();
    });

    test('unfavoriteChannel is defined', () => {
        expect((window as any).WebappUtils.channels.unfavoriteChannel).toBeDefined();
    });

    test('isFavoriteChannel is defined', () => {
        expect((window as any).WebappUtils.channels.isFavoriteChannel).toBeDefined();
    });
});

describe('messageHtmlToComponent wrapper', () => {
    const message = 'test';
    const options = {emoji: true, images: false};
    const isRHS = false;

    test('should call messageHtmlToComponent properly with only message', () => {
        (window as any).PostUtils.messageHtmlToComponent(message);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, undefined);
    });

    test('should call messageHtmlToComponent properly with message and options', () => {
        (window as any).PostUtils.messageHtmlToComponent(message, options);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, options);
    });

    test('should call messageHtmlToComponent properly with only message when deprecated isRHS parameter is passed', () => {
        (window as any).PostUtils.messageHtmlToComponent(message, isRHS);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, undefined);
    });

    test('should call messageHtmlToComponent properly with message and options when deprecated isRHS parameter is passed', () => {
        (window as any).PostUtils.messageHtmlToComponent(message, isRHS, options);

        expect(messageHtmlToComponent).toHaveBeenCalledWith(message, options);
    });
});
