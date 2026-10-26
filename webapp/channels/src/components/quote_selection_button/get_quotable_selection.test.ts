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

    test('should detect a left to right selection that ends on an element containing its start', () => {
        const message = document.getElementById('second')!.parentElement!;
        const selection = select(textOf('second'), 5, message, message.childNodes.length);

        expect(getQuotableSelection(selection)).toMatchObject({text: 'sapien pellentesque.', isBackward: false});
    });

    test('should return text spanning several paragraphs of the same message', () => {
        const selection = select(textOf('first'), 19, textOf('second'), 4);

        expect(getQuotableSelection(selection)?.text).toBe('dictumst nec.\n\nDiam');
    });

    test('should only quote the message text of a selection that spills over the rest of the post', () => {
        const selection = select(textOf('second'), 0, textOf('footer'), 3);

        expect(getQuotableSelection(selection)?.text).toBe('Diam sapien pellentesque.');
    });

    test('should keep the direction of a selection made from right to left that spills over the post', () => {
        const selection = select(textOf('footer'), 3, textOf('second'), 5);

        expect(getQuotableSelection(selection)).toMatchObject({text: 'sapien pellentesque.', isBackward: true});
    });

    test('should leave the selection as is so that it can still be copied as a whole', () => {
        const header = document.querySelector('.post__header')!.firstChild!;
        const selection = select(header, 0, textOf('second'), 4);

        expect(getQuotableSelection(selection)?.text).toBe('Ullamcorper eu mi, dictumst nec.\n\nDiam');
        expect({
            anchorNode: selection.anchorNode,
            anchorOffset: selection.anchorOffset,
            focusNode: selection.focusNode,
            focusOffset: selection.focusOffset,
        }).toEqual({anchorNode: header, anchorOffset: 0, focusNode: textOf('second'), focusOffset: 4});
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

    describe('on a wrapped line', () => {
        // "Diam sapien pellentesque." wraps after "Diam ", so "sapien" starts the second line at offset 5
        const WRAP_OFFSET = 5;

        beforeEach(() => {
            Range.prototype.getBoundingClientRect = function(this: Range) {
                const offset = this.startOffset;
                if (this.collapsed && offset === WRAP_OFFSET) {
                    // Like browsers, report the caret at the wrap point at the end of the first line
                    return new DOMRect(300, 40, 0, 20);
                }
                const onSecondLine = offset >= WRAP_OFFSET;
                const left = 10 * (onSecondLine ? offset - WRAP_OFFSET : offset);
                return new DOMRect(left, onSecondLine ? 60 : 40, this.collapsed ? 0 : 10, 20);
            };
        });

        afterEach(() => {
            Range.prototype.getBoundingClientRect = () => new DOMRect(120, 40, 0, 20);
        });

        test('should place the button at the start of the line when selecting backwards to it', () => {
            const selection = select(textOf('second'), 11, textOf('second'), WRAP_OFFSET);

            expect(getQuotableSelection(selection)).toMatchObject({text: 'sapien', isBackward: true, focusRect: {x: 0, y: 60, height: 20}});
        });

        test('should place the button after the last selected word when selecting forwards up to the wrap', () => {
            const selection = select(textOf('second'), 0, textOf('second'), WRAP_OFFSET);

            expect(getQuotableSelection(selection)).toMatchObject({text: 'Diam', isBackward: false, focusRect: {x: 40, y: 40, height: 20}});
        });
    });

    describe('formatting', () => {
        function renderMessage(html: string) {
            document.body.innerHTML = `<div id="post_${postId}"><div class="post-message__text">${html}</div></div>`;
        }

        test('should keep the formatting the selection is in', () => {
            renderMessage('<p>We are making <strong id="bold">excellent progress</strong> now.</p>');
            const selection = select(textOf('bold'), 0, textOf('bold'), 9);

            expect(getQuotableSelection(selection)?.text).toBe('**excellent**');
        });

        test('should quote part of a code block as a code block', () => {
            renderMessage('<div class="post-code"><div class="post-code__overlay"><span class="post-code__language">JavaScript</span></div><div class="hljs"><div class="post-code__line-numbers">1\n2</div><code id="code">const a = 1;\nconst b = 2;</code></div></div>');
            const selection = select(textOf('code'), 0, textOf('code'), 12);

            expect(getQuotableSelection(selection)?.text).toBe('```javascript\nconst a = 1;\n```');
        });

        test('should quote mentions by username', () => {
            renderMessage('<p id="text">cc <span data-mention="alex.morgan"><button><span>@Alex Morgan</span></button></span> please</p>');
            const paragraph = document.getElementById('text')!;
            const selection = select(paragraph, 0, paragraph, paragraph.childNodes.length);

            expect(getQuotableSelection(selection)?.text).toBe('cc @alex.morgan please');
        });
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
