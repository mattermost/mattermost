// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import dragster from './dragster';

describe('utils.dragster', () => {
    let div: HTMLElement;
    let unbind: () => void;
    let enterEvent: CustomEvent | null;
    let leaveEvent: CustomEvent | null;
    let overEvent: CustomEvent | null;
    let dropEvent: CustomEvent | null;
    const id = 'utils_dragster_test';
    const dragenter = new CustomEvent('dragenter', {detail: 'dragenter_detail'});
    const dragleave = new CustomEvent('dragleave', {detail: 'dragleave_detail'});
    const dragover = new CustomEvent('dragover', {detail: 'dragover_detail'});
    const drop = new CustomEvent('drop', {detail: 'drop_detail'});
    const options = {
        enter: (event: CustomEvent) => {
            enterEvent = event;
        },
        leave: (event: CustomEvent) => {
            leaveEvent = event;
        },
        over: (event: CustomEvent) => {
            overEvent = event;
        },
        drop: (event: CustomEvent) => {
            dropEvent = event;
        },
    };

    beforeAll(() => {
        div = document.createElement('div');
        document.body.appendChild(div);
        div.setAttribute('id', id);
        unbind = dragster(`#${id}`, options);
    });

    afterAll(() => {
        unbind();
        div.remove();
    });

    afterEach(() => {
        enterEvent = null;
        leaveEvent = null;
        overEvent = null;
        dropEvent = null;
    });

    it('should dispatch dragenter event', () => {
        div.dispatchEvent(dragenter);

        expect(enterEvent!.detail.detail).toEqual('dragenter_detail');
    });

    it('should dispatch dragleave event', () => {
        div.dispatchEvent(dragleave);

        expect(leaveEvent!.detail.detail).toEqual('dragleave_detail');
    });

    it('should dispatch dragover event', () => {
        div.dispatchEvent(dragover);

        expect(overEvent!.detail.detail).toEqual('dragover_detail');
    });

    it('should dispatch drop event', () => {
        div.dispatchEvent(drop);

        expect(dropEvent!.detail.detail).toEqual('drop_detail');
    });

    it('should dispatch dragenter event again', () => {
        div.dispatchEvent(dragenter);

        expect(enterEvent!.detail.detail).toEqual('dragenter_detail');
    });

    it('should dispatch dragenter event once if dispatched 2 times', () => {
        div.dispatchEvent(dragenter);

        expect(enterEvent).toBeNull();
    });
});
