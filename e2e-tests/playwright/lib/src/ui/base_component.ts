// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Locator} from '@playwright/test';
import {expect} from '@playwright/test';

export type SnapNode = {
    tag: string;
    attributes: {
        id?: string;
        class?: string;
        'data-testid'?: string;
        role?: string;
        'aria-label'?: string;
        'aria-expanded'?: string;
        'aria-checked'?: string;
        placeholder?: string;
        [key: string]: string | undefined;
    };
    text?: string;
    children: SnapNode[];
};

type SerializeArg = {maxDepth: number; stopSelectors: string[]};

export abstract class BaseComponent {
    readonly container: Locator;

    constructor(container: Locator) {
        this.container = container;
    }

    async toBeVisible(): Promise<void> {
        await expect(this.container).toBeVisible();
    }

    async snapshot(opts?: {depth?: number}): Promise<SnapNode> {
        const arg: SerializeArg = {
            maxDepth: opts?.depth ?? 10,
            stopSelectors: this.childContainerSelectors(),
        };

        return this.container.evaluate((el: Element, {maxDepth, stopSelectors}: SerializeArg): SnapNode => {
            type Node = {
                tag: string;
                attributes: Record<string, string | undefined>;
                text?: string;
                children: Node[];
            };

            function serializeNode(node: Element, depth: number): Node {
                const tag = node.tagName.toLowerCase();
                const attributes: Record<string, string | undefined> = {};

                for (const attr of Array.from(node.attributes)) {
                    attributes[attr.name] = attr.value;
                }

                const result: Node = {tag, attributes, children: []};

                if (depth >= maxDepth) {
                    return result;
                }

                const atBoundary =
                    stopSelectors.length > 0 &&
                    stopSelectors.some((sel: string) => {
                        try {
                            return node.matches(sel);
                        } catch {
                            return false;
                        }
                    });

                if (atBoundary) {
                    return result;
                }

                const childElements = Array.from(node.children);
                if (childElements.length === 0) {
                    const text = node.textContent?.trim();
                    if (text) {
                        result.text = text;
                    }
                } else {
                    result.children = childElements.map((child: Element) => serializeNode(child, depth + 1));
                }

                return result;
            }

            return serializeNode(el, 0) as SnapNode;
        }, arg);
    }

    protected childContainerSelectors(): string[] {
        return [];
    }
}
