// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function delayRequestToRoutes(routes = [], delay = 0) {
    cy.on('window:before:load', (win) => addDelay(win, routes, delay));
}

Cypress.Commands.add('delayRequestToRoutes', delayRequestToRoutes);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const addDelay = (win, routes, delay) => {
    const fetch = win.fetch;
    cy.stub(win, 'fetch').callsFake((...args) => {
        for (let i = 0; i < routes.length; i++) {
            if (args[0].includes(routes[i])) {
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

const mockWebsocketsFn = (win) => {
    const RealWebSocket = WebSocket;
    cy.stub(win, 'WebSocket').callsFake((...args) => {
        const mockWebSocket = {
            wrappedSocket: null,
            onopen: null,
            onmessage: null,
            onerror: null,
            onclose: null,
            send(data) {
                if (this.wrappedSocket) {
                    this.wrappedSocket.send(data);
                } else {
                    onerror();
                }
            },
            close() {
                if (this.wrappedSocket) {
                    this.wrappedSocket.close(1000);
                }
            },
            connect() {
                this.wrappedSocket = new RealWebSocket(...args);
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
            delayRequestToRoutes: typeof delayRequestToRoutes;
            mockWebsockets: typeof mockWebsockets;
        }
    }
}
