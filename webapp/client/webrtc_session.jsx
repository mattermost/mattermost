// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import adapter from 'webrtc-adapter';
import WebrtcClient from './webrtc_client.jsx';
const transationLength = 12;

export default class WebrtcSession {
    static randomString(len) {
        const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let randomString = '';
        for (let i = 0; i < len; i++) {
            const randomPoz = Math.floor(Math.random() * charSet.length);
            randomString += charSet.substring(randomPoz, randomPoz + 1);
        }
        return randomString;
    }

    static getLocalMedia(constraints, element, callback) {
        const media = constraints || {audio: true, video: true};
        navigator.mediaDevices.getUserMedia(media).
        then((stream) => {
            if (element) {
                element.srcObject = stream;
            }

            if (callback && typeof callback === 'function') {
                callback(null, stream);
            }
        }).
        catch((error) => {
            callback(error);
        });
    }

    static stopMediaStream(stream) {
        const tracks = stream.getTracks();
        tracks.forEach((track) => {
            track.stop();
        });
    }

    constructor(opts) {
        // super();
        const options = opts || {};
        this.getServer = this.getServer.bind(this);
        this.isConnected = this.isConnected.bind(this);
        this.getSessionId = this.getSessionId.bind(this);
        this.handleEvent = this.handleEvent.bind(this);
        this.keepAlive = this.keepAlive.bind(this);
        this.createSession = this.createSession.bind(this);
        this.attach = this.attach.bind(this);
        this.sendMessage = this.sendMessage.bind(this);
        this.sendTrickleCandidate = this.sendTrickleCandidate.bind(this);
        this.sendData = this.sendData.bind(this);
        this.sendDtmf = this.sendDtmf.bind(this);
        this.destroy = this.destroy.bind(this);
        this.destroyHandle = this.destroyHandle.bind(this);
        this.streamsDone = this.streamsDone.bind(this);
        this.prepareWebrtc = this.prepareWebrtc.bind(this);
        this.prepareWebrtcPeer = this.prepareWebrtcPeer.bind(this);
        this.createOffer = this.createOffer.bind(this);
        this.createAnswer = this.createAnswer.bind(this);
        this.sendSDP = this.sendSDP.bind(this);
        this.getVolume = this.getVolume.bind(this);
        this.isMuted = this.isMuted.bind(this);
        this.mute = this.mute.bind(this);
        this.getBitrate = this.getBitrate.bind(this);
        this.webrtcError = this.webrtcError.bind(this);
        this.cleanupWebrtc = this.cleanupWebrtc.bind(this);
        this.isAudioSendEnabled = this.isAudioSendEnabled.bind(this);
        this.isAudioRecvEnabled = this.isAudioRecvEnabled.bind(this);
        this.isVideoSendEnabled = this.isVideoSendEnabled.bind(this);
        this.isVideoRecvEnabled = this.isVideoRecvEnabled.bind(this);
        this.isDataEnabled = this.isDataEnabled.bind(this);
        this.isTrickleEnabled = this.isTrickleEnabled.bind(this);
        this.unbindWebSocket = this.unbindWebSocket.bind(this);

        this.websockets = false;
        this.ws = null;
        this.wsHandlers = {};
        this.wsKeepaliveTimeoutId = null;
        this.servers = null;
        this.server = null;
        this.serversIndex = 0;
        this.connected = false;
        this.sessionId = null;
        this.pluginHandles = {};
        this.retries = 0;
        this.transactions = {};

        this.client = new WebrtcClient();
        this.client.init({debug: options.debug});

        this.gatewayCallbacks = options || {};
        this.gatewayCallbacks.success = (typeof options.success == 'function') ? options.success : this.client.noop;
        this.gatewayCallbacks.error = (typeof options.error == 'function') ? options.error : this.client.noop;
        this.gatewayCallbacks.destroyed = (typeof options.destroyed == 'function') ? options.destroyed : this.client.noop;

        if (!this.client.initDone) {
            this.gatewayCallbacks.error('webrtc_client.not_initialize', 'Library not initialized');
            return {};
        }

        if (!this.client.isWebrtcSupported()) {
            this.gatewayCallbacks.error('webrtc_client.browser.not_supported', 'WebRTC not supported by this browser');
            return {};
        }

        this.client.log('Library initialized: ' + this.client.initDone);

        if (!options.server) {
            this.gatewayCallbacks.error('webrtc_client.invalid_gateway', 'Invalid gateway url');
            return {};
        }

        if (Array.isArray(options.server)) {
            this.client.log('Multiple servers provided (' + options.server.length + '), will use the first that works');
            for (let i = 0; i < options.server; i++) {
                const server = options.server[i];
                if (server.indexOf('ws') !== 0) {
                    this.gatewayCallbacks.error('webrtc_client.must_be_websocket', 'every server provided must be a websocket');
                    return {};
                }
            }
            this.servers = options.server;
            this.client.debug(this.servers);
        } else if (options.server.indexOf('ws') === 0) {
            this.websockets = true;
            this.servers = [options.server];
            this.client.log('Using WebSockets to contact Janus: ' + options.server);
        } else {
            this.gatewayCallbacks.error('webrtc_client.invalid_websocket', 'This library must connect to a websocket');
            return {};
        }

        this.iceServers = options.iceServers;
        if (!this.iceServers || this.iceServers.length === 0) {
            this.iceServers = [{url: 'stun:stun.l.google.com:19302'}];
        }

        // Optional max events
        this.maxev = null;
        if (options.max_poll_events) {
            this.maxev = options.max_poll_events;
        }
        if (this.maxev < 1) {
            this.maxev = 1;
        }

        // Token to use (only if the token based authentication mechanism is enabled)
        this.token = null;
        if (options.token) {
            this.token = options.token;
        }

        // API secret to use (only if the shared API secret is enabled)
        this.apisecret = null;
        if (options.apisecret) {
            this.apisecret = options.apisecret;
        }

        // Whether we should destroy this session when onbeforeunload is called
        this.destroyOnUnload = options.destroyOnUnload !== false;
        this.createSession();

        return this;
    }

    getServer() {
        return this.server;
    }

    isConnected() {
        return this.connected;
    }

    getSessionId() {
        return this.sessionId;
    }

    handleEvent(json) {
        this.retries = 0;
        this.client.debug('Got event on session ' + this.sessionId);
        this.client.debug(json);
        const transaction = json.transaction;
        const sender = json.sender;
        const plugindata = json.plugindata;
        const jsep = json.jsep;
        switch (json.janus) {
        case 'keepalive':
            // Nothing happened
            break;
        case 'ack':
        case 'success':
            // Success or just an ack, we can probably ignore
            if (transaction) {
                const reportSuccess = this.transactions[transaction];
                if (reportSuccess) {
                    reportSuccess(json);
                }
                Reflect.deleteProperty(this.transactions, transaction);
            }
            break;
        case 'webrtcup':
            // The PeerConnection with the gateway is up! Notify this
            if (sender) {
                const pluginHandle = this.pluginHandles[sender];
                if (pluginHandle) {
                    pluginHandle.webrtcState(true);
                } else {
                    this.client.warn('This handle is not attached to this session');
                }
            } else {
                this.client.warn('Missing sender...');
            }
            break;
        case 'hangup':
            // A plugin asked the core to hangup a PeerConnection on one of our handles
            if (sender) {
                const pluginHandle = this.pluginHandles[sender];
                if (pluginHandle) {
                    pluginHandle.webrtcState(false);
                    pluginHandle.hangup();
                } else {
                    this.client.warn('This handle is not attached to this session');
                }
            } else {
                this.client.warn('Missing sender...');
            }
            break;
        case 'detached':
            // A plugin asked the core to detach one of our handles
            if (sender) {
                const pluginHandle = this.pluginHandles[sender];
                if (pluginHandle) {
                    pluginHandle.ondetached();
                    pluginHandle.detach();
                } else {
                    this.client.warn('This handle is not attached to this session');
                }
            } else {
                this.client.warn('Missing sender...');
            }
            break;
        case 'media':
            // Media started/stopped flowing
            if (sender) {
                const pluginHandle = this.pluginHandles[sender];
                if (pluginHandle) {
                    pluginHandle.mediaState(json.type, json.receiving);
                } else {
                    this.client.warn('This handle is not attached to this session');
                }
            } else {
                this.client.warn('Missing sender...');
            }
            break;
        case 'error':
            // Oops, something wrong happened
            this.client.error('Ooops: ' + json.error.code + ' ' + json.error.reason);
            if (transaction) {
                const reportSuccess = this.transactions[transaction];
                if (reportSuccess) {
                    reportSuccess(json);
                }
                Reflect.deleteProperty(this.transactions, transaction);
            }
            break;
        case 'event':
            if (sender) {
                if (plugindata) {
                    this.client.debug(`  -- Event is coming from ${sender} ( ${plugindata.plugin} )`);
                    const data = plugindata.data;
                    this.client.debug(data);
                    const pluginHandle = this.pluginHandles[sender];
                    if (pluginHandle) {
                        pluginHandle.mediaState(json.type, json.receiving);
                        if (jsep) {
                            this.client.debug('Handling SDP as well...');
                            this.client.debug(jsep);
                        }
                        const callback = pluginHandle.onmessage;
                        if (callback) {
                            this.client.debug('Notifying application...');

                            // Send to callback specified when attaching plugin handle
                            callback(data, jsep);
                        } else {
                            // Send to generic callback (?)
                            this.client.debug('No provided notification callback');
                        }
                    } else {
                        this.client.warn('This handle is not attached to this session');
                    }
                } else {
                    this.client.warn('Missing plugindata...');
                }
            } else {
                this.client.warn('Missing sender...');
            }
            break;
        default:
            this.client.warn(`Unknown message "${json.janus}"`);
            break;
        }
    }

    keepAlive() {
        if (this.server === null || !this.websockets || !this.connected) {
            return;
        }
        this.wsKeepaliveTimeoutId = setTimeout(this.keepAlive, 30000);

        const request = {
            janus: 'keepalive',
            session_id: this.sessionId,
            transaction: WebrtcSession.randomString(transationLength)
        };

        if (this.token) {
            request.token = this.token;
        }

        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }

        this.ws.send(JSON.stringify(request));
    }

    createSession() {
        const transaction = WebrtcSession.randomString(transationLength);
        const request = {
            janus: 'create',
            transaction
        };

        if (this.token) {
            request.token = this.token;
        }

        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }

        if (this.server === null && Array.isArray(this.servers)) {
            // We still need to find a working server from the list we were given
            this.server = this.servers[this.serversIndex];
            if (this.server.indexOf('ws') === 0) {
                this.websockets = true;
                this.client.log('Server #' + (this.serversIndex + 1) + ': trying WebSockets to contact Janus (' + this.server + ')');
            }
        }

        if (this.websockets) {
            this.ws = new WebSocket(this.server, 'janus-protocol');
            this.wsHandlers = {
                error: () => {
                    this.client.error('Error connecting to the Janus WebSockets server... ' + this.server);
                    if (Array.isArray(this.servers)) {
                        this.serversIndex++;
                        if (this.serversIndex === this.servers.length) {
                            // We tried all the servers the user gave us and they all failed
                            this.gatewayCallbacks.error('webrtc_client.cannot_connect_servers', 'Error connecting to any of the provided Janus servers: Is the gateway down?');
                            return;
                        }

                        // Let's try the next server
                        this.server = null;
                        setTimeout(() => {
                            this.createSession();
                        }, 200);
                        return;
                    }
                    this.gatewayCallbacks.error('webrtc_client.cannot_connect_server', 'Error connecting to the Janus WebSockets server: Is the gateway down?');
                },

                open: () => {
                    // We need to be notified about the success
                    this.transactions[transaction] = (json) => {
                        this.client.debug(json);
                        if (json.janus !== 'success') {
                            this.client.error('Ooops: ' + json.error.code + ' ' + json.error.reason);	// FIXME
                            this.gatewayCallbacks.error(json.error.reason);
                            return;
                        }
                        this.wsKeepaliveTimeoutId = setTimeout(this.keepAlive, 30000);
                        this.connected = true;
                        this.sessionId = json.data.id;
                        this.client.log('Created session: ' + this.sessionId);
                        this.client.sessions[this.sessionId] = this;
                        this.gatewayCallbacks.success();
                    };
                    this.ws.send(JSON.stringify(request));
                },

                message: (event) => {
                    this.handleEvent(JSON.parse(event.data));
                },

                close: () => {
                    if (!this.connected) {
                        return;
                    }
                    this.connected = false;

                    // FIXME What if this is called when the page is closed?
                    this.gatewayCallbacks.error('Lost connection to the gateway (is it down?)');
                }
            };

            for (var eventName in this.wsHandlers) {
                if (this.wsHandlers.hasOwnProperty(eventName)) {
                    this.ws.addEventListener(eventName, this.wsHandlers[eventName]);
                }
            }
        }
    }

    attach(cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;
        callbacks.consentDialog = (typeof cbs.consentDialog == 'function') ? cbs.consentDialog : this.client.noop;
        callbacks.mediaState = (typeof cbs.mediaState == 'function') ? cbs.mediaState : this.client.noop;
        callbacks.webrtcState = (typeof cbs.webrtcState == 'function') ? cbs.webrtcState : this.client.noop;
        callbacks.onmessage = (typeof cbs.onmessage == 'function') ? cbs.onmessage : this.client.noop;
        callbacks.onlocalstream = (typeof cbs.onlocalstream == 'function') ? cbs.onlocalstream : this.client.noop;
        callbacks.onremotestream = (typeof cbs.onremotestream == 'function') ? cbs.onremotestream : this.client.noop;
        callbacks.ondata = (typeof cbs.ondata == 'function') ? cbs.ondata : this.client.noop;
        callbacks.ondataopen = (typeof cbs.ondataopen == 'function') ? cbs.ondataopen : this.client.noop;
        callbacks.oncleanup = (typeof cbs.oncleanup == 'function') ? cbs.oncleanup : this.client.noop;
        callbacks.ondetached = (typeof cbs.ondetached == 'function') ? cbs.ondetached : this.client.noop;

        if (!this.connected) {
            this.client.warn('Is the gateway down? (connected=false)');
            callbacks.error('Is the gateway down? (connected=false)');
            return;
        }

        const plugin = callbacks.plugin;
        if (!plugin) {
            this.client.error('Invalid plugin');
            callbacks.error('Invalid plugin');
            return;
        }

        const transaction = WebrtcSession.randomString(transationLength);
        const request = {
            janus: 'attach',
            plugin,
            transaction
        };

        if (this.token) {
            request.token = this.token;
        }

        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }

        if (this.websockets) {
            this.transactions[transaction] = (json) => {
                this.client.debug(json);

                if (json.janus !== 'success') {
                    const error = `Ooops: ${json.error.code} ${json.error.reason}`;
                    this.client.error(error);
                    callbacks.error(error);
                    return;
                }

                const handleId = json.data.id;

                this.client.log('Created handle: ' + handleId);
                const pluginHandle = {
                    session: this,
                    plugin,
                    id: handleId,
                    webrtcStuff: {
                        started: false,
                        myStream: null,
                        streamExternal: false,
                        remoteStream: null,
                        mySdp: null,
                        pc: null,
                        dataChannel: null,
                        dtmfSender: null,
                        trickle: true,
                        iceDone: false,
                        sdpSent: false,
                        volume: {
                            value: null,
                            timer: null
                        },
                        bitrate: {
                            value: null,
                            bsnow: null,
                            bsbefore: null,
                            tsnow: null,
                            tsbefore: null,
                            timer: null
                        }
                    },
                    getId: () => {
                        return handleId;
                    },
                    getPlugin: () => {
                        return plugin;
                    },
                    getVolume: () => {
                        return this.getVolume(handleId);
                    },
                    isAudioMuted: () => {
                        return this.isMuted(handleId, false);
                    },
                    muteAudio: () => {
                        return this.mute(handleId, false, true);
                    },
                    unmuteAudio: () => {
                        return this.mute(handleId, false, false);
                    },
                    isVideoMuted: () => {
                        return this.isMuted(handleId, true);
                    },
                    muteVideo: () => {
                        return this.mute(handleId, true, true);
                    },
                    unmuteVideo: () => {
                        return this.mute(handleId, true, false);
                    },
                    getBitrate: () => {
                        return this.getBitrate(handleId);
                    },
                    send: (cb) => {
                        this.sendMessage(handleId, cb);
                    },
                    data: (cb) => {
                        this.sendData(handleId, cb);
                    },
                    dtmf: (cb) => {
                        this.sendDtmf(handleId, cb);
                    },
                    consentDialog: callbacks.consentDialog,
                    mediaState: callbacks.mediaState,
                    webrtcState: callbacks.webrtcState,
                    onmessage: callbacks.onmessage,
                    createOffer: (cb) => {
                        this.prepareWebrtc(handleId, cb);
                    },
                    createAnswer: (cb) => {
                        this.prepareWebrtc(handleId, cb);
                    },
                    handleRemoteJsep: (cb) => {
                        this.prepareWebrtcPeer(handleId, cb);
                    },
                    onlocalstream: callbacks.onlocalstream,
                    onremotestream: callbacks.onremotestream,
                    ondata: callbacks.ondata,
                    ondataopen: callbacks.ondataopen,
                    oncleanup: callbacks.oncleanup,
                    ondetached: callbacks.ondetached,
                    hangup: (sendRequest) => {
                        this.cleanupWebrtc(handleId, sendRequest === true);
                    },
                    detach: (cb) => {
                        this.destroyHandle(handleId, cb);
                    }
                };
                this.pluginHandles[handleId] = pluginHandle;
                callbacks.success(pluginHandle);
            };
            request.session_id = this.sessionId;
            this.ws.send(JSON.stringify(request));
        }
    }

    sendMessage(handleId, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;

        if (!this.connected) {
            const error = 'Is the gateway down? (connected=false)';
            this.client.warn(error);
            callbacks.error(error);
            return;
        }

        const message = callbacks.message;
        const jsep = callbacks.jsep;
        const transaction = WebrtcSession.randomString(transationLength);
        const request = {
            janus: 'message',
            body: message,
            transaction
        };

        if (this.token) {
            request.token = this.token;
        }

        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }

        if (jsep) {
            request.jsep = jsep;
        }

        this.client.debug('Sending message to plugin (handle=' + handleId + '):');
        this.client.debug(request);

        if (this.websockets) {
            request.session_id = this.sessionId;
            request.handle_id = handleId;
            this.transactions[transaction] = (json) => {
                this.client.debug('Message sent!');
                this.client.debug(json);

                if (json.janus === 'success') {
                    // We got a success, must have been a synchronous transaction
                    const plugindata = json.plugindata;
                    if (!plugindata) {
                        this.client.warn('Request succeeded, but missing plugindata...');
                        callbacks.success();
                        return;
                    }

                    this.client.log('Synchronous transaction successful (' + plugindata.plugin + ')');
                    const data = plugindata.data;
                    this.client.debug(data);
                    callbacks.success(data);
                    return;
                } else if (json.janus !== 'ack') {
                    // Not a success and not an ack, must be an error
                    if (json.error) {
                        this.client.error('Ooops: ' + json.error.code + ' ' + json.error.reason);
                        callbacks.error(json.error.code + ' ' + json.error.reason);
                    } else {
                        this.client.error('Unknown error');
                        callbacks.error('Unknown error');
                    }
                    return;
                }

                // If we got here, the plugin decided to handle the request asynchronously
                callbacks.success();
            };
            this.ws.send(JSON.stringify(request));
        }
    }

    sendTrickleCandidate(handleId, candidate) {
        if (!this.connected) {
            this.client.warn('Is the gateway down? (connected=false)');
            return;
        }
        var request = {
            janus: 'trickle',
            candidate,
            transaction: WebrtcSession.randomString(transationLength)
        };

        if (this.token) {
            request.token = this.token;
        }

        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }
        this.client.debug('Sending trickle candidate (handle=' + handleId + '):');
        this.client.debug(request);

        if (this.websockets) {
            request.session_id = this.sessionId;
            request.handle_id = handleId;
            this.ws.send(JSON.stringify(request));
        }
    }

    sendData(handleId, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;
        const text = callbacks.text;
        if (!text) {
            this.client.warn('Invalid text');
            callbacks.error('Invalid text');
            return;
        }
        this.client.log('Sending string on data channel: ' + text);
        config.dataChannel.send(text);
        callbacks.success();
    }

    sendDtmf(handleId, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;

        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;
        if (!config.dtmfSender) {
            // Create the DTMF sender, if possible
            if (config.myStream) {
                const tracks = config.myStream.getAudioTracks();
                if (tracks && tracks.length > 0) {
                    const localAudioTrack = tracks[0];
                    config.dtmfSender = config.pc.createDTMFSender(localAudioTrack);
                    this.client.log('Created DTMF Sender');
                    config.dtmfSender.ontonechange = (tone) => {
                        this.client.debug('Sent DTMF tone: ' + tone.tone);
                    };
                }
            }
            if (!config.dtmfSender) {
                this.client.warn('Invalid DTMF configuration');
                callbacks.error('Invalid DTMF configuration');
                return;
            }
        }

        const dtmf = callbacks.dtmf;
        if (!dtmf) {
            this.client.warn('Invalid DTMF parameters');
            callbacks.error('Invalid DTMF parameters');
            return;
        }

        const tones = dtmf.tones;
        if (!tones) {
            this.client.warn('Invalid DTMF string');
            callbacks.error('Invalid DTMF string');
            return;
        }

        let duration = dtmf.duration;
        if (!duration) {
            duration = 500;	// We choose 500ms as the default duration for a tone
        }

        let gap = dtmf.gap;
        if (!gap) {
            gap = 50;	// We choose 50ms as the default gap between tones
        }

        this.client.debug('Sending DTMF string ' + tones + ' (duration ' + duration + 'ms, gap ' + gap + 'ms');
        config.dtmfSender.insertDTMF(tones, duration, gap);
    }

    destroy(sync) {
        const syncRequest = (sync === true);
        this.client.log('Destroying session ' + this.sessionId);

        if (!this.connected) {
            this.client.warn('Is the gateway down? (connected=false)');
            return;
        }

        if (!this.sessionId) {
            this.client.warn('No session to destroy');
            this.gatewayCallbacks.destroyed();
            return;
        }

        Reflect.deleteProperty(this.client.sessions, this.sessionId);

        // Destroy all handles first
        for (const ph in this.pluginHandles) {
            if (this.pluginHandles.hasOwnProperty(ph)) {
                const phv = this.pluginHandles[ph];
                this.client.log('Destroying handle ' + phv.id + ' (' + phv.plugin + ')');
                this.destroyHandle(phv.id, null, syncRequest);
            }
        }

        // Ok, go on
        var request = {janus: 'destroy', transaction: WebrtcSession.randomString(transationLength)};

        if (this.token) {
            request.token = this.token;
        }
        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }
        if (this.websockets) {
            request.session_id = this.sessionId;

            let onUnbindMessage = null;
            let onUnbindError = null;
            onUnbindMessage = (event) => {
                var data = JSON.parse(event.data);
                if (data.session_id === request.session_id && data.transaction === request.transaction) {
                    this.unbindWebSocket(onUnbindMessage, onUnbindError);
                    this.gatewayCallbacks.destroyed();
                }
            };
            onUnbindError = () => {
                this.unbindWebSocket(onUnbindMessage, onUnbindError);
                this.gatewayCallbacks.destroyed();
            };

            this.ws.addEventListener('message', onUnbindMessage);
            this.ws.addEventListener('error', onUnbindError);

            this.ws.send(JSON.stringify(request));
        }
    }

    disconnect() {
        this.connected = false;
        this.ws.close();
    }

    destroyHandle(handleId, cbs, sync) {
        const syncRequest = (sync === true);
        this.client.log('Destroying handle ' + handleId + ' (sync=' + syncRequest + ')');
        const callbacks = cbs || {};
        callbacks.success = (typeof callbacks.success == 'function') ? callbacks.success : this.client.noop;
        callbacks.error = (typeof callbacks.error == 'function') ? callbacks.error : this.client.noop;
        this.cleanupWebrtc(handleId);
        if (!this.connected) {
            this.client.warn('Is the gateway down? (connected=false)');
            return;
        }
        const request = {
            janus: 'detach',
            transaction: WebrtcSession.randomString(transationLength)
        };

        if (this.token) {
            request.token = this.token;
        }

        if (this.apisecret) {
            request.apisecret = this.apisecret;
        }

        if (this.websockets) {
            request.session_id = this.sessionId;
            request.handle_id = handleId;
            this.ws.send(JSON.stringify(request));

            Reflect.deleteProperty(this.pluginHandles, handleId);

            callbacks.success();
        }
    }

    streamsDone(handleId, jsep, media, callbacks, stream) {
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;
        this.client.debug('streamsDone:', stream);
        config.myStream = stream;

        const pcConfig = {iceServers: this.iceServers};
        const pcConstraints = {
            optional: [{DtlsSrtpKeyAgreement: true}]
        };

        this.client.log('Creating PeerConnection');
        this.client.debug(pcConstraints);
        config.pc = new window.RTCPeerConnection(pcConfig, pcConstraints);
        this.client.debug(config.pc);
        if (config.pc.getStats) {	// FIXME
            config.volume.value = 0;
            config.bitrate.value = '0 kbits/sec';
        }
        this.client.log('Preparing local SDP and gathering candidates (trickle=' + config.trickle + ')');

        config.pc.onicecandidate = (event) => {
            if (!event.candidate || (adapter.browserDetails.browser === 'edge' && event.candidate.candidate.indexOf('endOfCandidates') > 0)) {
                this.client.log('End of candidates.');
                config.iceDone = true;
                if (config.trickle === true) {
                    // Notify end of candidates
                    this.sendTrickleCandidate(handleId, {completed: true});
                } else {
                    // No trickle, time to send the complete SDP (including all candidates)
                    this.sendSDP(handleId, callbacks);
                }
            } else {
                // JSON.stringify doesn't work on some WebRTC objects anymore
                // See https://code.google.com/p/chromium/issues/detail?id=467366
                const candidate = {
                    candidate: event.candidate.candidate,
                    sdpMid: event.candidate.sdpMid,
                    sdpMLineIndex: event.candidate.sdpMLineIndex
                };

                if (config.trickle === true) {
                    // Send candidate
                    this.sendTrickleCandidate(handleId, candidate);
                }
            }
        };

        if (stream) {
            this.client.log('Adding local stream');
            config.pc.addStream(stream);
            pluginHandle.onlocalstream(stream);
        }

        config.pc.onaddstream = (remoteStream) => {
            this.client.log('Handling Remote Stream');
            this.client.debug(remoteStream);
            config.remoteStream = remoteStream;
            pluginHandle.onremotestream(remoteStream.stream);
        };

        // Any data channel to create?
        if (this.isDataEnabled(media)) {
            this.client.log('Creating data channel');
            const onDataChannelMessage = (event) => {
                this.client.log('Received message on data channel: ' + event.data);
                pluginHandle.ondata(event.data);	// FIXME
            };

            const onDataChannelStateChange = () => {
                const dcState = config.dataChannel ? config.dataChannel.readyState : 'null';
                this.client.log('State change on data channel: ' + dcState);
                if (dcState === 'open') {
                    pluginHandle.ondataopen();	// FIXME
                }
            };

            const onDataChannelError = (error) => {
                this.client.error('Got error on data channel:', error);

                // TODO
            };

            // Until we implement the proxying of open requests within the this.client core, we open a channel ourselves whatever the case
            config.dataChannel = config.pc.createDataChannel('this.clientDataChannel', {ordered: false});	// FIXME Add options (ordered, maxRetransmits, etc.)
            config.dataChannel.onmessage = onDataChannelMessage;
            config.dataChannel.onopen = onDataChannelStateChange;
            config.dataChannel.onclose = onDataChannelStateChange;
            config.dataChannel.onerror = onDataChannelError;
        }

        // Create offer/answer now DO I WANT THIS??
        if (jsep) {
            config.pc.setRemoteDescription(
                new RTCSessionDescription(jsep),
                () => {
                    this.client.log('Remote description accepted!');
                    this.createAnswer(handleId, media, callbacks);
                }, callbacks.error);
        } else {
            this.createOffer(handleId, media, callbacks);
        }
    }

    prepareWebrtc(handleId, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.webrtcError;
        const jsep = callbacks.jsep;
        const media = callbacks.media;
        const pluginHandle = this.pluginHandles[handleId];

        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;

        // Are we updating a session?
        if (config.pc) {
            this.client.log('Updating existing media session');

            // Create offer/answer now
            if (jsep) {
                config.pc.setRemoteDescription(
                    new window.RTCSessionDescription(jsep),
                    () => {
                        this.client.log('Remote description accepted!');
                        this.createAnswer(handleId, media, callbacks);
                    }, callbacks.error);
            } else {
                this.createOffer(handleId, media, callbacks);
            }
            return;
        }

        // Was a MediaStream object passed, or do we need to take care of that?
        if (callbacks.stream) {
            const stream = callbacks.stream;
            this.client.log('MediaStream provided by the application');
            this.client.debug(stream);

            // Skip the getUserMedia part
            config.streamExternal = true;
            this.streamsDone(handleId, jsep, media, callbacks, stream);
            return;
        }

        config.trickle = this.isTrickleEnabled(callbacks.trickle);
        if (this.isAudioSendEnabled(media) || this.isVideoSendEnabled(media)) {
            let constraints = {mandatory: {}, optional: []};
            pluginHandle.consentDialog(true);

            let audioSupport = this.isAudioSendEnabled(media);
            if (audioSupport === true && media) {
                if (typeof media.audio === 'object') {
                    audioSupport = media.audio;
                }
            }

            let videoSupport = this.isVideoSendEnabled(media);
            if (videoSupport === true && media) {
                if (media.video && media.video !== 'screen' && media.video !== 'window') {
                    let width = 0;
                    let height = 0;
                    let maxHeight = 0;

                    if (media.video === 'lowres') {
                        // Small resolution, 4:3
                        height = 240;
                        maxHeight = 240;
                        width = 320;
                    } else if (media.video === 'lowres-16:9') {
                        // Small resolution, 16:9
                        height = 180;
                        maxHeight = 180;
                        width = 320;
                    } else if (media.video === 'hires' || media.video === 'hires-16:9') {
                        // High resolution is only 16:9
                        height = 720;
                        maxHeight = 720;
                        width = 1280;
                        if (navigator.mozGetUserMedia) {
                            const firefoxVer = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
                            if (firefoxVer < 38) {
                                // Unless this is and old Firefox, which doesn't support it
                                this.client.warn(media.video + ' unsupported, falling back to stdres (old Firefox)');
                                height = 480;
                                maxHeight = 480;
                                width = 640;
                            }
                        }
                    } else if (media.video === 'stdres') {
                        // Normal resolution, 4:3
                        height = 480;
                        maxHeight = 480;
                        width = 640;
                    } else if (media.video === 'stdres-16:9') {
                        // Normal resolution, 16:9
                        height = 360;
                        maxHeight = 360;
                        width = 640;
                    } else {
                        this.client.log('Default video setting (' + media.video + ') is stdres 4:3');
                        height = 480;
                        maxHeight = 480;
                        width = 640;
                    }

                    this.client.log('Adding media constraint ' + media.video);

                    if (navigator.mozGetUserMedia) {
                        const firefoxVer = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
                        if (firefoxVer < 38) {
                            videoSupport = {
                                require: ['height', 'width'],
                                height: {max: maxHeight, min: height},
                                width: {max: width, min: width}
                            };
                        } else {
                            // http://stackoverflow.com/questions/28282385/webrtc-firefox-constraints/28911694#28911694
                            // https://github.com/meetecho/janus-gateway/pull/246
                            videoSupport = {
                                height: {ideal: height},
                                width: {ideal: width}
                            };
                        }
                    } else {
                        videoSupport = {
                            mandatory: {
                                maxHeight,
                                minHeight: height,
                                maxWidth: width,
                                minWidth: width
                            },
                            optional: []
                        };
                    }

                    if (typeof media.video === 'object') {
                        videoSupport = media.video;
                    }

                    this.client.debug(videoSupport);
                } else if (media.video === 'screen' || media.video === 'window') {
                    // Not a webcam, but screen capture
                    if (window.location.protocol !== 'https:') {
                        // Screen sharing mandates HTTPS
                        this.client.warn('Screen sharing only works on HTTPS, try the https:// version of this page');
                        pluginHandle.consentDialog(false);
                        callbacks.error('Screen sharing only works on HTTPS, try the https:// version of this page');
                        return;
                    }

                    // We're going to try and use the extension for Chrome 34+, the old approach
                    // for older versions of Chrome, or the experimental support in Firefox 33+
                    const cache = {};
                    const self = this;

                    function callbackUserMedia(error, stream) {
                        pluginHandle.consentDialog(false);
                        if (error) {
                            callbacks.error({code: error.code, name: error.name, message: error.message});
                        } else {
                            self.streamsDone(handleId, jsep, media, callbacks, stream);
                        }
                    }

                    function getScreenMedia(constraint, gsmCallback) {
                        this.client.log('Adding media constraint (screen capture)');
                        this.client.debug(constraint);
                        navigator.mediaDevices.getUserMedia(constraint).
                        then((stream) => {
                            gsmCallback(null, stream);
                        }).
                        catch((error) => {
                            pluginHandle.consentDialog(false);
                            gsmCallback(error);
                        });
                    }

                    if (window.navigator.userAgent.match('Chrome')) {
                        const chromever = parseInt(window.navigator.userAgent.match(/Chrome\/(.*) /)[1], 10);
                        let maxver = 33;

                        if (window.navigator.userAgent.match('Linux')) {
                            maxver = 35;	// 'known' crash in chrome 34 and 35 on linux
                        }

                        if (chromever >= 26 && chromever <= maxver) {
                            // Chrome 26->33 requires some awkward chrome://flags manipulation
                            constraints = {
                                video: {
                                    mandatory: {
                                        googLeakyBucket: true,
                                        maxWidth: window.screen.width,
                                        maxHeight: window.screen.height,
                                        maxFrameRate: 3,
                                        chromeMediaSource: 'screen'
                                    }
                                },
                                audio: this.isAudioSendEnabled(media)
                            };
                            getScreenMedia(constraints, callbackUserMedia);
                        } else {
                            // Chrome 34+ requires an extension
                            var pending = window.setTimeout(
                                () => {
                                    const error = new Error('NavigatorUserMediaError');
                                    error.name = 'The required Chrome extension is not installed: click <a href="#">here</a> to install it. (NOTE: this will need you to refresh the page)';
                                    pluginHandle.consentDialog(false);
                                    return callbacks.error(error);
                                }, 1000);
                            cache[pending] = [callbackUserMedia, null];
                            window.postMessage({
                                type: 'janusGetScreen',
                                id: pending
                            }, '*');
                        }
                    } else if (window.navigator.userAgent.match('Firefox')) {
                        const ffver = parseInt(window.navigator.userAgent.match(/Firefox\/(.*)/)[1], 10);
                        if (ffver >= 33) {
                            // Firefox 33+ has experimental support for screen sharing
                            constraints = {
                                video: {
                                    mozMediaSource: media.video,
                                    mediaSource: media.video
                                },
                                audio: this.isAudioSendEnabled(media)
                            };
                            getScreenMedia(constraints, (err, stream) => {
                                callbackUserMedia(err, stream);

                                // Workaround for https://bugzilla.mozilla.org/show_bug.cgi?id=1045810
                                if (!err) {
                                    let lastTime = stream.currentTime;
                                    const polly = window.setInterval(() => {
                                        if (!stream) {
                                            window.clearInterval(polly);
                                        }

                                        if (stream.currentTime === lastTime) {
                                            window.clearInterval(polly);
                                            if (stream.onended) {
                                                stream.onended();
                                            }
                                        }

                                        lastTime = stream.currentTime;
                                    }, 500);
                                }
                            });
                        } else {
                            const error = new Error('NavigatorUserMediaError');
                            error.name = 'Your version of Firefox does not support screen sharing, please install Firefox 33 (or more recent versions)';
                            pluginHandle.consentDialog(false);
                            callbacks.error(error);
                            return;
                        }
                    }

                    // Wait for events from the Chrome Extension
                    window.addEventListener('message', (event) => {
                        if (event.origin !== window.location.origin) {
                            return;
                        }
                        if (event.data.type === 'mattermostGotScreen' && cache[event.data.id]) {
                            const data = cache[event.data.id];
                            const callback = data[0];

                            Reflect.deleteProperty(cache, event.data.id);

                            if (event.data.sourceId === '') {
                                // user canceled
                                const error = new Error('NavigatorUserMediaError');
                                error.name = 'You cancelled the request for permission, giving up...';
                                pluginHandle.consentDialog(false);
                                callbacks.error(error);
                            } else {
                                constraints = {
                                    audio: this.isAudioSendEnabled(media),
                                    video: {
                                        mandatory: {
                                            chromeMediaSource: 'desktop',
                                            maxWidth: window.screen.width,
                                            maxHeight: window.screen.height,
                                            maxFrameRate: 3
                                        },
                                        optional: [
                                            {googLeakyBucket: true},
                                            {googTemporalLayeredScreencast: true}
                                        ]
                                    }
                                };
                                constraints.video.mandatory.chromeMediaSourceId = event.data.sourceId;
                                getScreenMedia(constraints, callback);
                            }
                        } else if (event.data.type === 'mattermostGetScreenPending') {
                            window.clearTimeout(event.data.id);
                        }
                    });
                    return;
                }
            }

            // If we got here, we're not screensharing
            if (!media || media.video !== 'screen') {
                // Check whether all media sources are actually available or not
                navigator.mediaDevices.enumerateDevices().then((devices) => {
                    const audioExist = devices.some((device) => {
                        return device.kind === 'audioinput';
                    });

                    const videoExist = devices.some((device) => {
                        return device.kind === 'videoinput';
                    });

                    // Check whether a missing device is really a problem
                    const audioSend = this.isAudioSendEnabled(media);
                    const videoSend = this.isVideoSendEnabled(media);

                    if (audioSend || videoSend) {
                        // We need to send either audio or video
                        const haveAudioDevice = audioSend ? audioExist : false;
                        const haveVideoDevice = videoSend ? videoExist : false;

                        if (!haveAudioDevice && !haveVideoDevice) {
                            // FIXME Should we really give up, or just assume recvonly for both?
                            pluginHandle.consentDialog(false);
                            callbacks.error('No capture device found');
                            return false;
                        }
                    }

                    navigator.mediaDevices.getUserMedia({
                        audio: audioExist ? audioSupport : false,
                        video: videoExist ? videoSupport : false
                    }).
                    then((stream) => {
                        pluginHandle.consentDialog(false);
                        this.streamsDone(handleId, jsep, media, callbacks, stream);
                    }).
                    catch((error) => {
                        pluginHandle.consentDialog(false);
                        callbacks.error({
                            code: error.code,
                            name: error.name,
                            message: error.message
                        });
                    });

                    return true;
                }).
                catch((error) => {
                    pluginHandle.consentDialog(false);
                    callbacks.error('enumerateDevices error', error);
                });
            }
        } else {
            // No need to do a getUserMedia, create offer/answer right away
            this.streamsDone(handleId, jsep, media, callbacks);
        }
    }

    prepareWebrtcPeer(handleId, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.webrtcError;

        const jsep = callbacks.jsep;
        const pluginHandle = this.pluginHandles[handleId];

        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;

        if (jsep) {
            if (config.pc === null) {
                this.client.warn('Wait, no PeerConnection?? if this is an answer, use createAnswer and not handleRemoteJsep');
                callbacks.error('No PeerConnection: if this is an answer, use createAnswer and not handleRemoteJsep');
                return;
            }
            config.pc.setRemoteDescription(
                new window.RTCSessionDescription(jsep),
                () => {
                    this.client.log('Remote description accepted!');
                    callbacks.success();
                }, callbacks.error);
        } else {
            callbacks.error('Invalid JSEP');
        }
    }

    createOffer(handleId, media, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;

        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;
        this.client.log('Creating offer (iceDone=' + config.iceDone + ')');

        // https://code.google.com/p/webrtc/issues/detail?id=3508
        let mediaConstraints = null;
        const browser = adapter.browserDetails.browser;
        if (browser === 'firefox' || browser === 'edge') {
            mediaConstraints = {
                offerToReceiveAudio: this.isAudioRecvEnabled(media),
                offerToReceiveVideo: this.isVideoRecvEnabled(media)
            };
        } else {
            mediaConstraints = {
                mandatory: {
                    OfferToReceiveAudio: this.isAudioRecvEnabled(media),
                    OfferToReceiveVideo: this.isVideoRecvEnabled(media)
                }
            };
        }

        this.client.debug(mediaConstraints);
        config.pc.createOffer(
            (offer) => {
                this.client.debug(offer);

                if (!config.mySdp) {
                    this.client.log('Setting local description');
                    config.mySdp = offer.sdp;
                    config.pc.setLocalDescription(offer);
                }

                if (!config.iceDone && !config.trickle) {
                    // Don't do anything until we have all candidates
                    this.client.log('Waiting for all candidates...');
                    return;
                }

                if (config.sdpSent) {
                    this.client.log('Offer already sent, not sending it again');
                    return;
                }

                this.client.log('Offer ready');
                this.client.debug(callbacks);
                config.sdpSent = true;

                // JSON.stringify doesn't work on some WebRTC objects anymore
                // See https://code.google.com/p/chromium/issues/detail?id=467366
                const jsep = {
                    type: offer.type,
                    sdp: offer.sdp
                };
                callbacks.success(jsep);
            }, callbacks.error, mediaConstraints);
    }

    createAnswer(handleId, media, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;

        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            callbacks.error('Invalid handle');
            return;
        }

        const config = pluginHandle.webrtcStuff;
        this.client.log('Creating answer (iceDone=' + config.iceDone + ')');

        let mediaConstraints = null;
        const browser = adapter.browserDetails.browser;
        if (browser === 'firefox' || browser === 'edge') {
            mediaConstraints = {
                offerToReceiveAudio: this.isAudioRecvEnabled(media),
                offerToReceiveVideo: this.isVideoRecvEnabled(media)
            };
        } else {
            mediaConstraints = {
                mandatory: {
                    OfferToReceiveAudio: this.isAudioRecvEnabled(media),
                    OfferToReceiveVideo: this.isVideoRecvEnabled(media)
                }
            };
        }
        this.client.debug(mediaConstraints);
        config.pc.createAnswer(
            (answer) => {
                this.client.debug(answer);
                if (!config.mySdp) {
                    this.client.log('Setting local description');
                    config.mySdp = answer.sdp;
                    config.pc.setLocalDescription(answer);
                }
                if (!config.iceDone && !config.trickle) {
                    // Don't do anything until we have all candidates
                    this.client.log('Waiting for all candidates...');
                    return;
                }
                if (config.sdpSent) {	// FIXME badly
                    this.client.log('Answer already sent, not sending it again');
                    return;
                }
                config.sdpSent = true;

                // JSON.stringify doesn't work on some WebRTC objects anymore
                // See https://code.google.com/p/chromium/issues/detail?id=467366
                const jsep = {
                    type: answer.type,
                    sdp: answer.sdp
                };
                callbacks.success(jsep);
            }, callbacks.error, mediaConstraints);
    }

    sendSDP(handleId, cbs) {
        const callbacks = cbs || {};
        callbacks.success = (typeof cbs.success == 'function') ? cbs.success : this.client.noop;
        callbacks.error = (typeof cbs.error == 'function') ? cbs.error : this.client.noop;

        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle, not sending anything');
            return;
        }

        const config = pluginHandle.webrtcStuff;
        this.client.log('Sending offer/answer SDP...');
        if (!config.mySdp) {
            this.client.warn('Local SDP instance is invalid, not sending anything...');
            return;
        }

        config.mySdp = {
            type: config.pc.localDescription.type,
            sdp: config.pc.localDescription.sdp
        };

        if (config.sdpSent) {
            this.client.log('Offer/Answer SDP already sent, not sending it again');
            return;
        }

        if (config.trickle === false) {
            config.mySdp.trickle = false;
        }
        this.client.debug(callbacks);
        config.sdpSent = true;
        callbacks.success(config.mySdp);
    }

    getVolume(handleId) {
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            return 0;
        }

        const config = pluginHandle.webrtcStuff;
        const browser = adapter.browserDetails.browser;

        // Start getting the volume, if getStats is supported
        if (config.pc.getStats && browser === 'chrome') {	// FIXME
            if (!config.remoteStream) {
                this.client.warn('Remote stream unavailable');
                return 0;
            }

            // http://webrtc.googlecode.com/svn/trunk/samples/js/demos/html/constraints-and-stats.html
            if (!config.volume.timer) {
                this.client.log('Starting volume monitor');
                config.volume.timer = setInterval(() => {
                    config.pc.getStats((stats) => {
                        const results = stats.result();
                        for (let i = 0; i < results.length; i++) {
                            const res = results[i];
                            if (res.type === 'ssrc' && res.stat('audioOutputLevel')) {
                                config.volume.value = res.stat('audioOutputLevel');
                            }
                        }
                    });
                }, 200);
                return 0;	// We don't have a volume to return yet
            }
            return config.volume.value;
        }

        this.client.log('Getting the remote volume unsupported by browser');
        return 0;
    }

    isMuted(handleId, video) {
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            return true;
        }

        const config = pluginHandle.webrtcStuff;

        if (!config.pc) {
            this.client.warn('Invalid PeerConnection');
            return true;
        }

        if (!config.myStream) {
            this.client.warn('Invalid local MediaStream');
            return true;
        }

        if (video) {
            // Check video track
            if (!config.myStream.getVideoTracks() || config.myStream.getVideoTracks().length === 0) {
                this.client.warn('No video track');
                return true;
            }
            return !config.myStream.getVideoTracks()[0].enabled;
        }

        // Check audio track
        if (!config.myStream.getAudioTracks() || config.myStream.getAudioTracks().length === 0) {
            this.client.warn('No audio track');
            return true;
        }
        return !config.myStream.getAudioTracks()[0].enabled;
    }

    mute(handleId, video, mute) {
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            return false;
        }

        const config = pluginHandle.webrtcStuff;
        if (!config.pc) {
            this.client.warn('Invalid PeerConnection');
            return false;
        }

        if (!config.myStream) {
            this.client.warn('Invalid local MediaStream');
            return false;
        }

        if (video) {
            // Mute/unmute video track
            if (!config.myStream.getVideoTracks() || config.myStream.getVideoTracks().length === 0) {
                this.client.warn('No video track');
                return false;
            }
            config.myStream.getVideoTracks()[0].enabled = mute;
            return true;
        }

        // Mute/unmute audio track
        if (!config.myStream.getAudioTracks() || config.myStream.getAudioTracks().length === 0) {
            this.client.warn('No audio track');
            return false;
        }
        config.myStream.getAudioTracks()[0].enabled = mute;
        return true;
    }

    getBitrate(handleId) {
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle || !pluginHandle.webrtcStuff) {
            this.client.warn('Invalid handle');
            return 'Invalid handle';
        }

        const config = pluginHandle.webrtcStuff;
        if (!config.pc) {
            return 'Invalid PeerConnection';
        }

        // Start getting the bitrate, if getStats is supported
        const browser = adapter.browserDetails.browser;
        if (config.pc.getStats && browser === 'chrome') {
            // Do it the Chrome way
            if (!config.remoteStream) {
                this.client.warn('Remote stream unavailable');
                return 'Remote stream unavailable';
            }

            // http://webrtc.googlecode.com/svn/trunk/samples/js/demos/html/constraints-and-stats.html
            if (!config.bitrate.timer) {
                this.client.log('Starting bitrate timer (Chrome)');
                config.bitrate.timer = setInterval(() => {
                    config.pc.getStats((stats) => {
                        const results = stats.result();
                        for (let i = 0; i < results.length; i++) {
                            const res = results[i];
                            if (res.type === 'ssrc' && res.stat('googFrameHeightReceived')) {
                                config.bitrate.bsnow = res.stat('bytesReceived');
                                config.bitrate.tsnow = res.timestamp;
                                if (config.bitrate.bsbefore === null || config.bitrate.tsbefore === null) {
                                    // Skip this round
                                    config.bitrate.bsbefore = config.bitrate.bsnow;
                                    config.bitrate.tsbefore = config.bitrate.tsnow;
                                } else {
                                    // Calculate bitrate
                                    var bitRate = Math.round(((config.bitrate.bsnow - config.bitrate.bsbefore) * 8) / (config.bitrate.tsnow - config.bitrate.tsbefore));
                                    config.bitrate.value = bitRate + ' kbits/sec';

                                    //~ this.client.log('Estimated bitrate is ' + config.bitrate.value);
                                    config.bitrate.bsbefore = config.bitrate.bsnow;
                                    config.bitrate.tsbefore = config.bitrate.tsnow;
                                }
                            }
                        }
                    });
                }, 1000);
                return '0 kbits/sec';	// We don't have a bitrate value yet
            }
            return config.bitrate.value;
        } else if (config.pc.getStats && browser === 'firefox') {
            // Do it the Firefox way
            if (!config.remoteStream || !config.remoteStream.stream) {
                this.client.warn('Remote stream unavailable');
                return 'Remote stream unavailable';
            }

            const videoTracks = config.remoteStream.stream.getVideoTracks();
            if (!videoTracks || videoTracks.length < 1) {
                this.client.warn('No video track');
                return 'No video track';
            }

            // https://github.com/muaz-khan/getStats/blob/master/getStats.js
            if (!config.bitrate.timer) {
                this.client.log('Starting bitrate timer (Firefox)');
                config.bitrate.timer = setInterval(() => {
                    // We need a helper callback
                    function cb(res) {
                        if (!res || res.inbound_rtp_video_1 == null || res.inbound_rtp_video_1 == null) {
                            config.bitrate.value = 'Missing inbound_rtp_video_1';
                            return;
                        }

                        config.bitrate.bsnow = res.inbound_rtp_video_1.bytesReceived;
                        config.bitrate.tsnow = res.inbound_rtp_video_1.timestamp;

                        if (config.bitrate.bsbefore === null || config.bitrate.tsbefore === null) {
                            // Skip this round
                            config.bitrate.bsbefore = config.bitrate.bsnow;
                            config.bitrate.tsbefore = config.bitrate.tsnow;
                        } else {
                            // Calculate bitrate
                            var bitRate = Math.round(((config.bitrate.bsnow - config.bitrate.bsbefore) * 8) / (config.bitrate.tsnow - config.bitrate.tsbefore));
                            config.bitrate.value = bitRate + ' kbits/sec';
                            config.bitrate.bsbefore = config.bitrate.bsnow;
                            config.bitrate.tsbefore = config.bitrate.tsnow;
                        }
                    }

                    // Actually get the stats
                    config.pc.getStats(videoTracks[0], (stats) => {
                        cb(stats);
                    }, cb);
                }, 1000);
                return '0 kbits/sec';	// We don't have a bitrate value yet
            }
            return config.bitrate.value;
        }

        this.client.warn('Getting the video bitrate unsupported by browser');
        return 'Feature unsupported by browser';
    }

    webrtcError(error) {
        this.client.error('WebRTC error:', error);
    }

    cleanupWebrtc(handleId, hangupRequest) {
        this.client.log('Cleaning WebRTC stuff');
        const pluginHandle = this.pluginHandles[handleId];
        if (!pluginHandle) {
            // Nothing to clean
            return;
        }

        const config = pluginHandle.webrtcStuff;
        if (config) {
            if (hangupRequest === true) {
                // Send a hangup request (we don't really care about the response)
                const request = {
                    janus: 'hangup',
                    transaction: WebrtcSession.randomString(transationLength)
                };

                if (this.token) {
                    request.token = this.token;
                }

                if (this.apisecret) {
                    request.apisecret = this.apisecret;
                }

                this.client.debug('Sending hangup request (handle=' + handleId + '):');
                this.client.debug(request);
                if (this.websockets) {
                    request.session_id = this.sessionId;
                    request.handle_id = handleId;
                    this.ws.send(JSON.stringify(request));
                }
            }

            // Cleanup stack
            config.remoteStream = null;
            if (config.volume.timer) {
                clearInterval(config.volume.timer);
            }

            config.volume.value = null;
            if (config.bitrate.timer) {
                clearInterval(config.bitrate.timer);
            }

            config.bitrate.timer = null;
            config.bitrate.bsnow = null;
            config.bitrate.bsbefore = null;
            config.bitrate.tsnow = null;
            config.bitrate.tsbefore = null;
            config.bitrate.value = null;

            try {
                // Try a MediaStream.stop() first
                if (!config.streamExternal && config.myStream) {
                    this.client.log('Stopping local stream');
                    config.myStream.stop();
                }
            } catch (e) {
                // Do nothing if this fails
            }

            try {
                // Try a MediaStreamTrack.stop() for each track as well
                if (!config.streamExternal && config.myStream) {
                    this.client.log('Stopping local stream tracks');
                    WebrtcSession.stopMediaStream(config.myStream);
                }
            } catch (e) {
                // Do nothing if this fails
            }

            config.streamExternal = false;
            config.myStream = null;

            // Close PeerConnection
            try {
                config.pc.close();
            } catch (e) {
                // Do nothing
            }
            config.pc = null;
            config.mySdp = null;
            config.iceDone = false;
            config.sdpSent = false;
            config.dataChannel = null;
            config.dtmfSender = null;
        }
        pluginHandle.oncleanup();
    }

    isAudioSendEnabled(media) {
        this.client.debug('isAudioSendEnabled:', media);
        if (!media) {
            return true;	// Default
        }

        if (media.audio === false) {
            return false;	// Generic audio has precedence
        }

        if (!media.audioSend) {
            return true;	// Default
        }

        return (media.audioSend === true);
    }

    isAudioRecvEnabled(media) {
        this.client.debug('isAudioRecvEnabled:', media);
        if (!media) {
            return true;	// Default
        }

        if (media.audio === false) {
            return false;	// Generic audio has precedence
        }

        if (!media.audioRecv) {
            return true;	// Default
        }

        return (media.audioRecv === true);
    }

    isVideoSendEnabled(media) {
        this.client.debug('isVideoSendEnabled:', media);
        const browser = adapter.browserDetails.browser;
        if (browser === 'edge') {
            this.client.warn("Edge doesn't support compatible video yet");
            return false;
        }

        if (!media) {
            return true;	// Default
        }

        if (media.video === false) {
            return false;	// Generic video has precedence
        }

        if (!media.videoSend) {
            return true;	// Default
        }

        return (media.videoSend === true);
    }

    isVideoRecvEnabled(media) {
        this.client.debug('isVideoRecvEnabled:', media);
        const browser = adapter.browserDetails.browser;
        if (browser === 'edge') {
            this.client.warn("Edge doesn't support compatible video yet");
            return false;
        }

        if (!media) {
            return true;	// Default
        }

        if (media.video === false) {
            return false;	// Generic video has precedence
        }

        if (!media.videoRecv) {
            return true;	// Default
        }

        return (media.videoRecv === true);
    }

    isDataEnabled(media) {
        this.client.debug('isDataEnabled:', media);
        const browser = adapter.browserDetails.browser;
        if (browser === 'edge') {
            this.client.warn("Edge doesn't support data channels yet");
            return false;
        }

        if (!media) {
            return false;	// Default
        }

        return (media.data === true);
    }

    isTrickleEnabled(trickle) {
        this.client.debug('isTrickleEnabled:', trickle);
        if (!trickle) {
            return true;	// Default is true
        }

        return (trickle === true);
    }

    unbindWebSocket = (onUnbindMessage, onUnbindError) => {
        for (var eventName in this.wsHandlers) {
            if (this.wsHandlers.hasOwnProperty(eventName)) {
                this.ws.removeEventListener(eventName, this.wsHandlers[eventName]);
            }
        }
        this.ws.removeEventListener('message', onUnbindMessage);
        this.ws.removeEventListener('error', onUnbindError);
        if (this.wsKeepaliveTimeoutId) {
            clearTimeout(this.wsKeepaliveTimeoutId);
        }
    };
}