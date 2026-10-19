// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as reactJSXDevRuntime from 'react/jsx-dev-runtime';
import * as reactJSXRuntime from 'react/jsx-runtime';
import type {Root} from 'react-dom/client';

import {LogLevel} from '@mattermost/types/client4';

import {Client4} from 'mattermost-redux/client';

import {act, render} from 'tests/react_testing_utils';
import messageHtmlToComponent from 'utils/message_html_to_component';

import './export';

jest.mock('utils/message_html_to_component');

describe('window JSX runtime exports', () => {
    const hostJSXRuntime = (window as any).ReactJSXRuntime;
    const hostJSXDevRuntime = (window as any).ReactJSXDevRuntime;

    test('exposes the host runtime helpers and a callable development helper', () => {
        expect(hostJSXRuntime.Fragment).toBe(reactJSXRuntime.Fragment);
        expect(hostJSXRuntime.jsx).toBe(reactJSXRuntime.jsx);
        expect(hostJSXRuntime.jsxs).toBe(reactJSXRuntime.jsxs);
        expect(hostJSXDevRuntime.Fragment).toBe(reactJSXDevRuntime.Fragment);
        expect(typeof hostJSXDevRuntime.jsxDEV).toBe('function');

        if (reactJSXDevRuntime.jsxDEV) {
            expect(hostJSXDevRuntime.jsxDEV).toBe(reactJSXDevRuntime.jsxDEV);
        }
    });

    test.each(['jsx', 'jsxDEV'] as const)('%s creates keyed content with refs and fragments', (helper) => {
        const ref = React.createRef<HTMLSpanElement>();
        const props = {ref, children: 'Runtime child'};
        const child = helper === 'jsx' ?
            hostJSXRuntime.jsx('span', props, 'child-key') :
            hostJSXDevRuntime.jsxDEV('span', props, 'child-key', false);
        const fragment = helper === 'jsx' ?
            hostJSXRuntime.jsxs(hostJSXRuntime.Fragment, {children: [child]}, 'fragment-key') :
            hostJSXDevRuntime.jsxDEV(hostJSXDevRuntime.Fragment, {children: [child]}, 'fragment-key', true);

        const {getByText} = render(fragment);
        const renderedChild = getByText('Runtime child');

        expect(renderedChild).toHaveTextContent('Runtime child');
        expect(ref.current).toBe(renderedChild);
        expect(child.key).toBe('child-key');
        expect(fragment.key).toBe('fragment-key');
    });
});

describe('window.ReactDOM supports React 18 development client shims', () => {
    let enableLogging: boolean;

    beforeEach(() => {
        enableLogging = Client4.enableLogging;
        Client4.enableLogging = true;
        jest.spyOn(Client4, 'logClientError').mockResolvedValue({message: 'logged'});
        jest.spyOn(Math, 'random').mockReturnValue(0);
    });

    afterEach(() => {
        Client4.enableLogging = enableLogging;
        jest.restoreAllMocks();
    });

    test.each(['createRoot', 'hydrateRoot'])('%s mounts plugin content', async (method) => {
        const reactDOM = (window as any).ReactDOM;
        const {__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: internals} = reactDOM;
        const container = document.createElement('div');
        const content = React.createElement('div', null, 'Plugin content');
        let root: Root;

        if (method === 'hydrateRoot') {
            container.innerHTML = '<div>Plugin content</div>';
        }

        await act(async () => {
            internals.usingClientEntryPoint = true;
            try {
                if (method === 'createRoot') {
                    root = reactDOM.createRoot(container);
                    root.render(content);
                } else {
                    root = reactDOM.hydrateRoot(container, content);
                }
            } finally {
                internals.usingClientEntryPoint = false;
            }
        });

        expect(container).toHaveTextContent('Plugin content');
        expect(internals.usingClientEntryPoint).toBe(false);
        expect(Client4.logClientError).toHaveBeenCalledWith(
            `plugin_react_dom_shim_used api=${method} plugin_id=unknown plugin_version=unknown`,
            LogLevel.Debug,
        );

        await act(async () => root.unmount());
        expect(container).toBeEmptyDOMElement();
    });
});

describe('window.Components exposes plugin modals', () => {
    test('EditChannelHeaderModal is defined', () => {
        expect((window as any).Components.EditChannelHeaderModal).toBeDefined();
    });

    test('ChannelNotificationsModal is defined', () => {
        expect((window as any).Components.ChannelNotificationsModal).toBeDefined();
    });
});

describe('window.Components exposes ABAC policy editors', () => {
    test('AccessControlTableEditor is defined', () => {
        expect((window as any).Components.AccessControlTableEditor).toBeDefined();
    });

    test('AccessControlCELEditor is defined', () => {
        expect((window as any).Components.AccessControlCELEditor).toBeDefined();
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

describe('window.WebappUtils.modals.openModalById', () => {
    test('opens an allowlisted modal by id with the given props', () => {
        const action = (window as any).WebappUtils.modals.openModalById('team_settings', {focusOriginElement: 'channel-header'});

        expect(action.modalId).toBe('team_settings');
        expect(action.dialogProps).toEqual({focusOriginElement: 'channel-header'});
        expect(typeof action.dialogType).toBe('function');
    });
});

describe('window.WebappUtils.modals.canOpenModalId', () => {
    test('is true for an allowlisted modal id', () => {
        expect((window as any).WebappUtils.modals.canOpenModalId('team_settings')).toBe(true);
    });

    test('is false for an id the web app does not publish', () => {
        expect((window as any).WebappUtils.modals.canOpenModalId('channel_invite')).toBe(false);
        expect((window as any).WebappUtils.modals.canOpenModalId('not_a_real_modal')).toBe(false);
    });
});

describe('window.WebappUtils.openUserSettings', () => {
    test('opens the user settings modal', () => {
        const action = (window as any).WebappUtils.openUserSettings({isContentProductSettings: false});

        expect(action.modalId).toBe('user_settings');
        expect(action.dialogProps).toEqual({isContentProductSettings: false});
    });
});
