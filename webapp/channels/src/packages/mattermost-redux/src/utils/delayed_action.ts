// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export default class DelayedAction<F extends (...args: any) => any> {
    action: F;
    timer: NodeJS.Timeout | null;

    constructor(action: F) {
        this.action = action;

        this.timer = null;
    }

    fire = (): void => {
        this.action();

        this.timer = null;
    };

    fireAfter = (timeout: number): void => {
        if (this.timer !== null) {
            clearTimeout(this.timer);
        }

        this.timer = setTimeout(this.fire, timeout);
    };

    cancel = (): void => {
        if (this.timer !== null) {
            clearTimeout(this.timer);
        }
    };
}
