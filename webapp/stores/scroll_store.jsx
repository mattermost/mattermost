// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import EventEmitter from 'events';

const UPDATE_POST_SCROLL_EVENT = 'update_post_scroll';

class ScrollStoreClass extends EventEmitter {
    emitPostScroll() {
        this.emit(UPDATE_POST_SCROLL_EVENT);
    }

    addPostScrollListener(callback) {
        this.on(UPDATE_POST_SCROLL_EVENT, callback);
    }

    removePostScrollLisener(callback) {
        this.removeListener(UPDATE_POST_SCROLL_EVENT, callback);
    }
}

var ScrollStore = new ScrollStoreClass();
export default ScrollStore;

