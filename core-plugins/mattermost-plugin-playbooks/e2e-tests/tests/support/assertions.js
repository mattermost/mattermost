// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Asserts that an item in the channel sidebar is not unread.
export function beRead(items) {
    expect(items).to.have.length(1);
    expect(items[0].className).to.not.match(/unread-title/);
}

// Asserts that an item in the channel sidebar is read.
export function beUnread(items) {
    expect(items).to.have.length(1);
    expect(items[0].className).to.match(/unread-title/);
}

// Asserts that an item in the channel sidebar is muted.
export function beMuted(items) {
    expect(items).to.have.length(1);
    expect(items[0].className).to.match(/muted/);
}

// Asserts that an item in the channel sidebar is unmuted.
export function beUnmuted(items) {
    expect(items).to.have.length(1);
    expect(items[0].className).to.not.match(/muted/);
}
