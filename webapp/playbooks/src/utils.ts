import {useState} from 'react';

import {PlaybookRun} from 'src/types/playbook_run';
import {Checklist} from 'src/types/playbook';

let idCounter = 0;

// uniqueId generates a unique id with an optional prefix.
export const uniqueId = (prefix ?: string) => prefix + String(++idCounter);

// useUniqueId exports a React hook simplifying the use of uniqueId.
//
// Note that changes to the prefix will not effect a change to the unique identifier.
export const useUniqueId = (prefix ?: string) => {
    const [id] = useState(() => uniqueId(prefix));

    return id;
};

// findLastUpdated returns the date (in millis) that the playbook run was last updated, or 0 if it
// hasn't been updated yet.
export const findLastUpdated = (playbookRun: PlaybookRun) => {
    const posts = [...playbookRun.status_posts]
        .filter((a) => a.delete_at === 0)
        .sort((a, b) => b.create_at - a.create_at);
    return posts.length === 0 ? 0 : posts[0].create_at;
};

// findLastUpdatedWithDefault returns the date (in millis) that the playbook run was last updated,
// or the playbook run's create_at if it hasn't been updated yet.
export const findLastUpdatedWithDefault = (playbookRun: PlaybookRun) => {
    const lastUpdated = findLastUpdated(playbookRun);
    return lastUpdated > 0 ? lastUpdated : playbookRun.create_at;
};

/** Smart rounding with `multiple` support */
export const nearest = (
    n: number,
    multiple = 1,
    method: 'round' | 'floor' | 'ceil' = 'round',
) => Math[method](n / multiple) * multiple;

// copied from webapp
export function copyToClipboard(data: any) {
    // Attempt to use the newer clipboard API when possible
    const clipboard = navigator.clipboard;
    if (clipboard) {
        clipboard.writeText(data);
        return;
    }

    // creates a tiny temporary text area to copy text out of
    // see https://stackoverflow.com/a/30810322/591374 for details
    const textArea = document.createElement('textarea');
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.value = data;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

export const KeyCodes: Record<string, [string, number]> = {
    ENTER: ['Enter', 13],
    COMPOSING: ['Composing', 229],
    SPACE: ['Space', 32],
};

export function isKeyPressed(event: KeyboardEvent, key: [string, number]): boolean {
    // There are two types of keyboards
    // 1. English with different layouts(Ex: Dvorak)
    // 2. Different language keyboards(Ex: Russian)

    if (event.keyCode === KeyCodes.COMPOSING[1]) {
        return false;
    }

    // checks for event.key for older browsers and also for the case of different English layout keyboards.
    if (typeof event.key !== 'undefined' && event.key !== 'Unidentified' && event.key !== 'Dead') {
        const isPressedByCode = event.key === key[0] || event.key === key[0].toUpperCase();
        if (isPressedByCode) {
            return true;
        }
    }

    // used for different language keyboards to detect the position of keys
    if (event.code) {
        return event.code === key[0];
    }

    // legacy
    return event.keyCode === key[1];
}

type ResolvableFunction<TVal> = (...TArgs: any) => TVal;

export type Resolvable<TVal> = ResolvableFunction<TVal> | TVal;

export function resolve<TVal>(prop: Resolvable<TVal>, ...args: any): TVal {
    return typeof prop === 'function' ? (prop as ResolvableFunction<TVal>)(...args) : prop;
}

export function getDistinctAssignees(checklists: Checklist[]) {
    return [
        ...checklists.reduce((assignees, cl) => {
            cl.items.forEach((ci) => {
                if (ci.assignee_id) {
                    assignees.add(ci.assignee_id);
                }
            });
            return assignees;
        }, new Set<string>()),
    ];
}

export function runCallsSlashCommand(command: string, channelId: string, teamId: string) {
    window.postMessage({
        type: 'calls-run-slash-command',
        message: command,
        args: {
            channel_id: channelId,
            team_id: teamId,
        },
    }, window.origin);
}
