// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {ChainableT} from '@/types';

interface MockWebSocket {
    wrappedSocket: WebSocket | null;
    onopen: ((ev: Event) => void) | null;
    onmessage: ((ev: MessageEvent) => void) | null;
    onerror: ((ev: Event) => void) | null;
    onclose: ((ev: CloseEvent) => void) | null;
    send(data: string | ArrayBuffer): void;
    close(): void;
    connect(): void;
}

declare global {
    interface Window {
        mockWebsockets: MockWebSocket[];
    }
}

function delayRequestToRoutes(routes: string[] = [], delay = 0) {
    cy.on('window:before:load', (win) => addDelay(win, routes, delay));
}

Cypress.Commands.add('delayRequestToRoutes', delayRequestToRoutes);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const addDelay = (win: Cypress.AUTWindow, routes: string[], delay: number) => {
    const fetch = win.fetch;
    cy.stub(win, 'fetch').callsFake((...args: [RequestInfo | URL, RequestInit?]) => {
        for (let i = 0; i < routes.length; i++) {
            if (String(args[0]).includes(routes[i])) {
                return wait(delay).then(() => fetch(...args));
            }
        }

        return fetch(...args);
    });
};

// Websocket list to use with mockWebsockets
window.mockWebsockets = [];

function mockWebsockets() {
    cy.on('window:before:load', (win) => mockWebsocketsFn(win));
}

// Wrap websocket to be able to connect and close connections on demand
Cypress.Commands.add('mockWebsockets', mockWebsockets);

const mockWebsocketsFn = (win: Cypress.AUTWindow) => {
    const RealWebSocket = WebSocket;
    cy.stub(win, 'WebSocket').callsFake((...args: ConstructorParameters<typeof WebSocket>) => {
        const mockWebSocket: MockWebSocket = {
            wrappedSocket: null as WebSocket | null,
            onopen: null as ((ev: Event) => void) | null,
            onmessage: null as ((ev: MessageEvent) => void) | null,
            onerror: null as ((ev: Event) => void) | null,
            onclose: null as ((ev: CloseEvent) => void) | null,
            send(data: string | ArrayBuffer) {
                if (this.wrappedSocket) {
                    this.wrappedSocket.send(data);
                } else if (this.onerror) {
                    this.onerror(new Event('error'));
                }
            },
            close() {
                if (this.wrappedSocket) {
                    this.wrappedSocket.close(1000);
                }
            },
            connect() {
                const [param1, restOfParams] = args;
                this.wrappedSocket = new RealWebSocket(param1, restOfParams);
                this.wrappedSocket.onopen = this.onopen;
                this.wrappedSocket.onmessage = this.onmessage;
                this.wrappedSocket.onerror = this.onerror;
                this.wrappedSocket.onclose = this.onclose;
            },
        };
        window.mockWebsockets.push(mockWebSocket);
        return mockWebSocket;
    });
};

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Cypress {
        interface Chainable {
            delayRequestToRoutes(routes: string[], delay: number): ChainableT<void>;
            mockWebsockets: typeof mockWebsockets;
        }
    }
}
