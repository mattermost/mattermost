// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function isFunction(obj: any): boolean {
    return typeof obj === 'function';
}

type Listener = (...args: any[]) => void;

class EventEmitter {
    listeners: Map<string, Listener[]>;

    constructor() {
        this.listeners = new Map();
    }

    addListener(label: string, callback: Listener): void {
        if (!this.listeners.has(label)) {
            this.listeners.set(label, []);
        }

        this.listeners.get(label)!.push(callback);
    }

    on(label: string, callback: Listener): void {
        this.addListener(label, callback);
    }

    removeListener(label: string, callback: Listener): boolean {
        const listeners = this.listeners.get(label);
        let index;

        if (listeners && listeners.length) {
            index = listeners.reduce((i, listener, idx) => {
                return isFunction(listener) && listener === callback ? idx : i;
            }, -1);

            if (index > -1) {
                listeners.splice(index, 1);
                this.listeners.set(label, listeners);
                return true;
            }
        }
        return false;
    }

    off(label: string, callback: Listener): void {
        this.removeListener(label, callback);
    }

    emit(label: string, ...args: any[]): boolean {
        const listeners = this.listeners.get(label);

        if (listeners && listeners.length) {
            listeners.forEach((listener) => {
                listener(...args);
            });
            return true;
        }
        return false;
    }
}

export default new EventEmitter();
