// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Writable} from 'node:stream';

import blessed from 'blessed';
import stripAnsi from 'strip-ansi';

class Runner {
    commands;
    filter = '';
    ui;

    scrollLocked = true;

    buffer = [];
    partialBuffer = '';

    outputStream;

    closeListeners = new Set();

    constructor(commands) {
        this.commands = commands;
        this.outputStream = new Writable({
            write: (chunk, encoding, callback) => this.writeToStream(chunk, encoding, callback),
        });

        this.makeUi(commands.map((command) => command.name), this.onFilter);
        this.registerHotkeys();
    }

    // Initialization

    makeUi(commandNames) {
        // Set up screen and output panes
        const screen = blessed.screen({
            smartCSR: true,
            dockBorders: true,
        });

        const output = blessed.box({
            top: 0,
            left: 0,
            width: '100%',
            height: '100%-3',
            content: 'THE END IS NEVER '.repeat(1000),
            tags: true,
            alwaysScroll: true,
            scrollable: true,
            scrollbar: {
                ch: '#',
                style: {},
                track: {
                    ch: '|',
                },
            },
            style: {},
        });

        screen.append(output);

        // Set up the menu bar
        const menu = blessed.listbar({
            top: '100%-3',
            left: 0,
            width: '100%',
            height: 3,
            border: {
                type: 'line',
            },
            style: {
                item: {
                    bg: 'red',
                    hover: {
                        bg: 'green',
                    },
                },
                selected: {
                    bg: 'blue',
                },
            },
            tags: true,
            autoCommandKeys: true,
            mouse: true,
        });

        menu.add('All', () => this.onFilter(''));
        for (const name of commandNames) {
            menu.add(name, () => this.onFilter(name));
        }

        screen.append(menu);

        this.ui = {
            menu,
            output,
            screen,
        };
    }

    registerHotkeys() {
        this.ui.screen.key(['escape', 'q', 'C-c'], () => {
            for (const listener of this.closeListeners) {
                listener();
            }
        });

        this.ui.screen.key(['up', 'down'], (char, key) => {
            this.scrollDelta(key.name === 'up' ? -1 : 1);
        });
        this.ui.screen.on('wheelup', () => {
            this.scrollDelta(-3);
        });
        this.ui.screen.on('wheeldown', () => {
            this.scrollDelta(3);
        });
        this.ui.screen.key('end', () => {
            this.scrollToBottom();
        });
    }

    // Rendering and internal logic

    renderUi() {
        const filtered = this.buffer.filter((line) => this.filter === '' || line.tag === this.filter);

        this.ui.output.setContent(filtered.map((line) => this.formatLine(line)).join('\n'));

        if (this.scrollLocked) {
            this.ui.output.scrollbar.style.inverse = true;
            this.ui.output.setScrollPerc(100);
        } else {
            this.ui.output.scrollbar.style.inverse = false;
        }

        this.ui.screen.render();
    }

    formatLine(line) {
        const color = this.commands.find((command) => command.name === line.tag)?.prefixColor;

        return color ? `{bold}{${color}-fg}[${line.tag}]{/} ${line.text}` : `[${line.tag}] ${line.text}`;
    }

    onFilter(newFilter) {
        this.filter = newFilter;

        this.scrollLocked = true;
        this.renderUi();
    }

    scrollDelta(delta) {
        this.ui.output.scroll(delta);

        if (this.ui.output.getScrollPerc() >= 100 || this.ui.output.getScrollHeight() <= this.ui.output.height) {
            this.scrollLocked = true;
        } else {
            this.scrollLocked = false;
        }

        this.renderUi();
    }

    scrollToBottom() {
        this.scrollLocked = true;
        this.renderUi();
    }

    // Terminal output handling

    getOutputStream() {
        return this.outputStream;
    }

    writeToStream(chunk, encoding, callback) {
        const str = String(chunk);

        if (str.includes('\n')) {
            const parts = str.split('\n');

            // Add completed lines to buffer
            this.appendToBuffer(this.partialBuffer + parts[0]);

            for (let i = 1; i < parts.length - 1; i++) {
                this.appendToBuffer(parts[i]);
            }

            // Track partial line
            this.partialBuffer = parts[parts.length - 1];
        } else {
            // Track partial line
            this.partialBuffer += str;
        }

        this.renderUi();

        callback();
    }

    appendToBuffer(line) {
        // This regex is more complicated than expected because it
        const match = (/^\[([^\]]*)\]\s*(.*)$/).exec(stripAnsi(line));

        if (match) {
            this.buffer.push({tag: match[1], text: match[2]});
        } else {
            this.buffer.push({tag: '', text: 'Line not recognized correctly: ' + line});
        }

        // Keep the buffer from using too much memory by removing the oldest chunk of it every time it goes over 5000 lines
        const bufferCapacity = 5000;
        const capacityReduction = 1000;

        if (this.buffer.length > bufferCapacity) {
            this.buffer = this.buffer.slice(this.buffer.length - capacityReduction);
        }
    }

    // Event handlers

    addCloseListener(listener) {
        this.closeListeners.add(listener);
    }

    removeCloseListener(listener) {
        this.closeListeners.remove(listener);
    }
}

export function makeRunner(commands) {
    const runner = new Runner(commands);

    runner.renderUi();

    return runner;
}
