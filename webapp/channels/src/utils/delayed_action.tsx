// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

export default class DelayedAction {
    private action: () => void;
    private timer: number;

    public constructor(action: () => void) {
        this.action = action;

        this.timer = -1;

        // bind fire since it doesn't get passed the correct this value with setTimeout
        this.fire = this.fire.bind(this);
    }

    public fire() {
        this.action();

        this.timer = -1;
    }

    public fireAfter(timeout: number) {
        if (this.timer >= 0) {
            window.clearTimeout(this.timer);
        }

        this.timer = window.setTimeout(this.fire, timeout);
    }

    public cancel() {
        window.clearTimeout(this.timer);
    }
}
