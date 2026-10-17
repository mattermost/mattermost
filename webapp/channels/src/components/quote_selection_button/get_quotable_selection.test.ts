// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {getQuotableSelection} from './get_quotable_selection';

const postId = 'abcdefghijklmnopqrstuvwxyz';
const otherPostId = 'zyxwvutsrqponmlkjihgfedcba';

function renderPosts() {
    document.body.innerHTML = `
        <div id="post_${postId}">
            <div class="post__header">Michael Whitfield</div>
            <div class="post-message__text"><p id="first">Ullamcorper eu mi, dictumst nec.</p><p id="second">Diam sapien pellentesque.</p></div>
            <div id="footer">3 replies</div>
        </div>
        <div id="post_${otherPostId}">
            <span class="profile-icon"></span>
            <div class="post-message__text"><p id="other">Another message</p></div>
        </div>
        <div id="rhsPost_${postId}">
            <div class="post-message__text"><p id="rhs">Reply in a thread</p></div>
        </div>
    `;
}

function textOf(id: string) {
    return document.getElementById(id)!.firstChild!;
}

function select(anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number) {
    const selection = window.getSelection()!;
    selection.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
    return selection;
}

describe('getQuotableSelection', () => {
    const originalGetBoundingClientRect = Range.prototype.getBoundingClientRect;
    const originalGetClientRects = Range.prototype.getClientRects;

    beforeAll(() => {
        // jsdom doesn't do layout, so pretend every caret position is at the same spot
        Range.prototype.getBoundingClientRect = () => new DOMRect(120, 40, 0, 20);
        Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
    });

    afterAll(() => {
        Range.prototype.getBoundingClientRect = originalGetBoundingClientRect;
        Range.prototype.getClientRects = originalGetClientRects;
    });

    beforeEach(() => {
        renderPosts();
    });

    afterEach(() => {
        window.getSelection()?.removeAllRanges();
    });

    test('should return the selected text of a post in the center channel', () => {
        const selection = select(textOf('second'), 0, textOf('second'), 11);

        expect(getQuotableSelection(selection)).toEqual({
            postId,
            isRHS: false,
            text: 'Diam sapien',
            focusRect: {x: 120, y: 40, height: 20},
            isBackward: false,
        });
    });

    test('should detect posts shown in the RHS', () => {
        const selection = select(textOf('rhs'), 0, textOf('rhs'), 5);

        expect(getQuotableSelection(selection)).toMatchObject({postId, isRHS: true, text: 'Reply'});
    });

    test('should detect a selection made from right to left', () => {
        const selection = select(textOf('second'), 11, textOf('second'), 0);

        expect(getQuotableSelection(selection)).toMatchObject({text: 'Diam sapien', isBackward: true});
    });

    test('should return text spanning several paragraphs of the same message', () => {
        const selection = select(textOf('first'), 19, textOf('second'), 4);

        expect(getQuotableSelection(selection)?.text).toBe('dictumst nec.Diam');
    });

    test('should trim a selection that spills over the rest of the post', () => {
        const selection = select(textOf('second'), 0, textOf('footer'), 3);

        expect(getQuotableSelection(selection)?.text).toBe('Diam sapien pellentesque.');
        expect(selection.focusNode).toBe(document.getElementById('second')!.parentElement);
    });

    test('should keep the direction of a trimmed selection made from right to left', () => {
        const selection = select(textOf('footer'), 3, textOf('second'), 5);

        expect(getQuotableSelection(selection)).toMatchObject({text: 'sapien pellentesque.', isBackward: true});
        expect(selection.anchorNode).toBe(document.getElementById('second')!.parentElement);
    });

    test('should trim a triple-click selection that ends at the start of the next post', () => {
        const selection = select(textOf('second'), 0, textOf('other'), 0);

        expect(getQuotableSelection(selection)).toMatchObject({postId, text: 'Diam sapien pellentesque.'});
    });

    test('should trim a triple-click selection that ends on the avatar of the next post', () => {
        const avatar = document.querySelector(`#post_${otherPostId} .profile-icon`)!;
        const selection = select(textOf('second'), 0, avatar, 0);

        expect(getQuotableSelection(selection)).toMatchObject({postId, text: 'Diam sapien pellentesque.'});
    });

    test('should ignore a collapsed selection', () => {
        const selection = select(textOf('second'), 3, textOf('second'), 3);

        expect(getQuotableSelection(selection)).toBeNull();
    });

    test('should ignore a selection spanning several posts', () => {
        const selection = select(textOf('second'), 0, textOf('other'), 7);

        expect(getQuotableSelection(selection)).toBeNull();
    });

    test('should ignore a selection outside of the message text', () => {
        const selection = select(textOf('footer'), 0, textOf('footer'), 9);

        expect(getQuotableSelection(selection)).toBeNull();
    });

    test('should ignore a selection outside of any post', () => {
        document.body.insertAdjacentHTML('beforeend', '<p id="outside">Not a post</p>');
        const selection = select(textOf('outside'), 0, textOf('outside'), 3);

        expect(getQuotableSelection(selection)).toBeNull();
    });

    test('should ignore whitespace-only selections', () => {
        document.getElementById('second')!.insertAdjacentHTML('afterend', '<p id="blank">   </p>');
        const selection = select(textOf('blank'), 0, textOf('blank'), 3);

        expect(getQuotableSelection(selection)).toBeNull();
    });
});
