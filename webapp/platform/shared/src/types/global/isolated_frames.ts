// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Plugin-facing contract for `window.WebappUtils.isolatedFrames`.
//
// Any frame on the page can post a message to the Mattermost window, and every
// `message` listener on that window receives it. A plugin that frames untrusted
// content (for example, a sandboxed iframe running generated HTML) registers the
// frame here: the web app then delivers messages from that frame, and from every
// frame nested inside it, to the plugin's handler only, and no other listener on
// the window ever sees them.

export type IsolatedFrameMessageHandler = (event: MessageEvent) => void;

export type PublishedIsolatedFrameUtils = {

    /**
     * Routes every `message` event posted to this window from `frame`, or from any
     * frame nested inside it, to `handler` alone. Messages are matched by the
     * frame's place in the frame tree, not by origin, so they are routed even after
     * the frame navigates. Returns a function that removes the registration; call it
     * when the frame is removed.
     */
    register: (frame: HTMLIFrameElement, handler: IsolatedFrameMessageHandler) => () => void;
};
