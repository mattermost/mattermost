import EventEmitter from 'events';

import AppDispatcher from 'dispatcher/app_dispatcher.jsx';
import Constants from 'utils/constants.jsx';

const ActionTypes = Constants.ActionTypes;

const CHANGE_EVENT = 'change';
const URL_DATA_CHANGE_EVENT = 'url_data_change';

class OpenGraphStoreClass extends EventEmitter {
    constructor() {
        super();
        this.ogDataObject = {};  // Format: {<url>: <data-object>}
    }

    emitChange() {
        this.emit(CHANGE_EVENT);
    }

    addChangeListener(callback) {
        this.on(CHANGE_EVENT, callback);
    }

    removeChangeListener(callback) {
        this.removeListener(CHANGE_EVENT, callback);
    }

    emitUrlDataChange(url) {
        this.emit(URL_DATA_CHANGE_EVENT, url);
    }

    addUrlDataChangeListener(callback) {
        this.on(URL_DATA_CHANGE_EVENT, callback);
    }

    removeUrlDataChangeListener(callback) {
        this.removeListener(URL_DATA_CHANGE_EVENT, callback);
    }

    storeOgInfo(url, ogInfo) {
        this.ogDataObject[url] = ogInfo;
    }

    getOgInfo(url) {
        return this.ogDataObject[url];
    }
}

var OpenGraphStore = new OpenGraphStoreClass();

// Not expecting more that `Constants.POST_CHUNK_SIZE` post previews rendered at a time
OpenGraphStore.setMaxListeners(Constants.POST_CHUNK_SIZE);

OpenGraphStore.dispatchToken = AppDispatcher.register((payload) => {
    var action = payload.action;

    switch (action.type) {
    case ActionTypes.RECIVED_OPEN_GRAPH_METADATA:
        OpenGraphStore.storeOgInfo(action.url, action.data);
        OpenGraphStore.emitUrlDataChange(action.url);
        OpenGraphStore.emitChange();
        break;
    default:
    }
});

export default OpenGraphStore;
