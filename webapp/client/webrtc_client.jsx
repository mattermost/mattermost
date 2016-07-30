// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class WebrtcClient {
    constructor() {
        this.init = this.init.bind(this);
        this.listDevices = this.listDevices.bind(this);
        this.isExtensionEnabled = this.isExtensionEnabled.bind(this);
        this.isWebrtcSupported = this.isWebrtcSupported.bind(this);

        this.initDone = false;
        this.sessions = {};
    }

    noop() {} //eslint-disable-line no-empty-function

    // this function is going to be needed when we enable screen sharing
    isExtensionEnabled() {
        if (window.navigator.userAgent.match('Chrome')) {
            const chromever = parseInt(window.navigator.userAgent.match(/Chrome\/(.*) /)[1], 10);
            let maxver = 33;
            if (window.navigator.userAgent.match('Linux')) {
                maxver = 35;	// "known" crash in chrome 34 and 35 on linux
            }
            if (chromever >= 26 && chromever <= maxver) {
                // Older versions of Chrome don't support this extension-based approach, so lie
                return true;
            }
            return (document.getElementById('mattermost-extension-installed') !== null);
        }

        // Firefox of others, no need for the extension (but this doesn't mean it will work)
        return true;
    }

    init(opts) {
        const options = opts || {};

        if (this.initDone === true) {
            // Already initialized
            return;
        }

        this.trace = this.noop;
        this.debug = this.noop;
        this.log = this.noop;
        this.warn = this.noop;
        this.error = this.noop;

        /* eslint-disable */
        if (options.debug === true || options.debug === 'all') {
            // Enable all debugging levels
            this.trace = console.trace.bind(console);
            this.debug = console.debug.bind(console);
            this.log = console.log.bind(console);
            this.warn = console.warn.bind(console);
            this.error = console.error.bind(console);
        } else if (Array.isArray(options.debug)) {
            for (const i in options.debug) {
                if (options.debug.hasOwnProperty(i)) {
                    const d = options.debug[i];
                    switch (d) {
                    case 'trace':
                        this.trace = console.trace.bind(console);
                        break;
                    case 'debug':
                        this.debug = console.debug.bind(console);
                        break;
                    case 'log':
                        this.log = console.log.bind(console);
                        break;
                    case 'warn':
                        this.warn = console.warn.bind(console);
                        break;
                    case 'error':
                        this.error = console.error.bind(console);
                        break;
                    default:
                        console.error("Unknown debugging option '" + d + "' (supported: 'trace', 'debug', 'log', warn', 'error')");
                        break;
                    }
                }
            }
        }
        /* eslint-enable */

        this.log('Initializing WebRTC Client library');

        // Detect tab close
        window.onbeforeunload = () => {
            this.log('Closing window');
            for (const s in this.sessions) {
                if (this.sessions.hasOwnProperty(s)) {
                    if (this.sessions[s] && this.sessions[s].destroyOnUnload) {
                        this.log('Destroying session ' + s);
                        this.sessions[s].destroy();
                    }
                }
            }
        };

        this.initDone = true;
    }

    // Helper method to enumerate devices
    listDevices(cb) {
        const callback = (typeof cb == 'function') ? cb : this.noop;

        if (navigator.mediaDevices) {
            navigator.getUserMedia({audio: true, video: true}, (stream) => {
                navigator.mediaDevices.enumerateDevices().then((devices) => {
                    this.debug(devices);
                    callback(devices);

                    // Get rid of the now useless stream
                    try {
                        stream.stop();
                    } catch (e) {
                        this.error(e);
                    }

                    this.stopMedia(stream);
                });
            }, (err) => {
                this.error(err);
                callback([]);
            });
        } else {
            this.warn('navigator.mediaDevices unavailable');
            callback([]);
        }
    }

    // Helper method to check whether WebRTC is supported by this browser
    isWebrtcSupported() {
        return window.RTCPeerConnection && navigator.getUserMedia;
    }

    stopMedia(stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => {
            track.stop();
        });
    }
}