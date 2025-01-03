// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

type Options = {
    enter?: (event: CustomEvent) => void;
    leave?: (event: CustomEvent) => void;
    over?: (event: CustomEvent) => void;
    drop?: (event: CustomEvent) => void;
}

export default function dragster(query: string, options: Options) {
    const preventDefault = (e: Event) => {
        e.preventDefault();
    };

    const defaults = {
        enter: preventDefault,
        leave: preventDefault,
        over: preventDefault,
        drop: preventDefault,
    };

    const settings = Object.assign(defaults, options);
    const node = document.querySelector(query);

    if (!node) {
        return () => {};
    }

    let first = false;
    let second = false;

    const dragenter = (event: Event) => {
        if (first) {
            second = true;
            return;
        }

        first = true;
        const enterEvent = new CustomEvent('dragster:enter', {detail: event});
        node.dispatchEvent(enterEvent);
    };

    const dragleave = (event: Event) => {
        if (second) {
            second = false;
        } else if (first) {
            first = false;
        }
        if (!first && !second) {
            const leaveEvent = new CustomEvent('dragster:leave', {detail: event});
            node.dispatchEvent(leaveEvent);
        }
    };

    const dragover = (event: Event) => {
        const overEvent = new CustomEvent('dragster:over', {detail: event});
        node.dispatchEvent(overEvent);
    };

    const drop = (event: Event) => {
        if (second) {
            second = false;
        } else if (first) {
            first = false;
        }
        if (!first && !second) {
            const dropEvent = new CustomEvent('dragster:drop', {detail: event});
            node.dispatchEvent(dropEvent);
        }
    };

    node.addEventListener('dragenter', dragenter);
    node.addEventListener('dragleave', dragleave);
    node.addEventListener('dragover', dragover);
    node.addEventListener('drop', drop);

    node.addEventListener('dragster:enter', settings.enter);
    node.addEventListener('dragster:leave', settings.leave);
    node.addEventListener('dragster:over', settings.over);
    node.addEventListener('dragster:drop', settings.drop);

    const unbindEvents = () => {
        node.removeEventListener('dragenter', dragenter);
        node.removeEventListener('dragleave', dragleave);
        node.removeEventListener('dragover', dragover);
        node.removeEventListener('drop', drop);

        node.removeEventListener('dragster:enter', settings.enter);
        node.removeEventListener('dragster:leave', settings.leave);
        node.removeEventListener('dragster:over', settings.over);
        node.removeEventListener('dragster:drop', settings.drop);
    };

    return unbindEvents;
}

