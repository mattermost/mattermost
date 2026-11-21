// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Specs reach elements through the generated page objects (`app.channelHeader.openMenuButton`), not hand-written
// selectors: a literal locator in a spec is a magic string the generator can't keep in sync with the webapp. Text a
// user types and values from generated types (`Msg`, `Api`, key sets) are fine.
//
// Besides string literals, the rule finds the same selectors written other ways (each can be turned off by option):
// - `templates`: a template literal with runtime parts (`page.getByTestId(`post_${id}`)`);
// - `variables`: a same-file `const` holding the string (`const SAVE = 'Save'; page.getByRole('button', {name: SAVE})`);
// - `hasText`: a literal text filter (`items.filter({hasText: 'Town Square'})`);
// - `selectors`: a `data-testid` selector in any string, such as `querySelector` inside `evaluate`.
//
// And three more ways round the page objects (each can be turned off by option):
// - `roles`: `getByRole('menuitem')` with no name is a raw lookup too; give the part an id, or say why with a reason;
// - `pageRooted`: any lookup made directly on the page (`page.getByTestId(id)`, `app.page.locator(selector)`), whatever its argument;
// - `legacy`: the old `$`, `$$`, `$eval`, `$$eval` and `waitForSelector`, and DOM queries by selector (`querySelector`,
//   `querySelectorAll`, `getElementById`, `getElementsBy*`).
import {constInit, isStringLiteral, objectProperty} from './e2e-utils.js';

const LOCATOR_METHODS = new Set(['locator', 'getByTestId', 'getByText', 'getByLabel', 'getByPlaceholder', 'getByTitle', 'getByAltText']);
const DEFAULTS = {templates: true, variables: true, hasText: true, selectors: true, roles: true, pageRooted: true, legacy: true};
const LEGACY_METHODS = new Set(['$', '$$', '$eval', '$$eval', 'waitForSelector', 'querySelector', 'querySelectorAll', 'getElementById', 'getElementsByClassName', 'getElementsByTagName', 'getElementsByName']);

/** Whether a node is the page itself: `page`, `app.page`, `this.page`. */
function isPage(node) {
    return (node.type === 'Identifier' && node.name === 'page') || (node.type === 'MemberExpression' && !node.computed && node.property.name === 'page');
}

function isLiteral(node) {
    return isStringLiteral(node) || (node && node.type === 'Literal' && node.regex !== undefined);
}

function stringParts(node) {
    if (node.type === 'Literal' && typeof node.value === 'string') {
        return [node.value];
    }
    if (node.type === 'TemplateLiteral') {
        return node.quasis.map((q) => q.value.cooked ?? q.value.raw);
    }
    return [];
}

export default {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallow string-literal locators in e2e specs; use the generated page objects',
        },
        schema: [{
            type: 'object',
            properties: {
                templates: {type: 'boolean'},
                variables: {type: 'boolean'},
                hasText: {type: 'boolean'},
                selectors: {type: 'boolean'},
                roles: {type: 'boolean'},
                pageRooted: {type: 'boolean'},
                legacy: {type: 'boolean'},
            },
            additionalProperties: false,
        }],
    },
    create: (context) => {
        const opts = {...DEFAULTS, ...context.options[0]};
        const reported = new Set();

        // How a locator argument is written: 'literal', 'template', 'variable', or null when it's fine.
        const kindOf = (node) => {
            if (!node) {
                return null;
            }
            if (isLiteral(node)) {
                return 'literal';
            }
            if (opts.templates && node.type === 'TemplateLiteral') {
                return 'template';
            }
            if (opts.variables) {
                const init = constInit(context, node);
                if (init && (isLiteral(init) || (opts.templates && init.type === 'TemplateLiteral'))) {
                    return 'variable';
                }
            }
            return null;
        };
        const how = {literal: 'a literal', template: 'a template literal', variable: 'a string held in a const'};

        const report = (node, message) => {
            reported.add(node);
            context.report({node, message});
        };

        return {
            CallExpression: (node) => {
                const callee = node.callee;
                if (callee.type !== 'MemberExpression' || callee.computed || callee.property.type !== 'Identifier') {
                    return;
                }
                const method = callee.property.name;
                if (opts.legacy && LEGACY_METHODS.has(method)) {
                    report(callee.property, `\`${method}()\` in a spec reaches into the page by selector. Reach the element through \`app\` (the generated page objects); to read the DOM, pass their locator to \`evaluate\`.`);
                    return;
                }
                if (opts.pageRooted && (LOCATOR_METHODS.has(method) || method === 'getByRole') && isPage(callee.object)) {
                    report(callee.property, `\`${method}()\` on the page in a spec is a raw lookup. Reach the element through \`app\` (the generated page objects); migrate the webapp area if it has no testids yet.`);
                    return;
                }
                if (LOCATOR_METHODS.has(method)) {
                    const kind = kindOf(node.arguments[0]);
                    if (kind) {
                        report(node.arguments[0], `\`${method}()\` with ${how[kind]} in a spec. Reach the element through \`app\` (the generated page objects); migrate the webapp area if it has no testids yet.`);
                    }
                    return;
                }
                if (method === 'getByRole') {
                    const name = objectProperty(node.arguments[1], 'name');
                    if (opts.roles && !name && isLiteral(node.arguments[0])) {
                        report(node.arguments[0], '`getByRole()` with only a role in a spec is a raw lookup. Reach the element through `app` (the generated page objects); if the part has no id, add one, or say why with a reason.');
                        return;
                    }
                    const kind = name && kindOf(name.value);
                    if (kind) {
                        report(name.value, `\`getByRole()\` with ${kind === 'literal' ? 'a literal name' : `${how[kind]} as the name`} in a spec. Use the generated page objects, or \`Msg\` for the accessible name.`);
                    }
                    return;
                }
                if (method === 'filter' && opts.hasText) {
                    for (const key of ['hasText', 'hasNotText']) {
                        const prop = objectProperty(node.arguments[0], key);
                        const kind = prop && kindOf(prop.value);
                        if (kind) {
                            report(prop.value, `\`filter({${key}})\` with ${how[kind]} in a spec. Reach the item by its key through the generated page objects, or match \`Msg\` text with \`toHaveMessage\`.`);
                        }
                    }
                }
            },
            'Literal, TemplateLiteral': (node) => {
                if (!opts.selectors || reported.has(node) || !stringParts(node).some((s) => s.includes('data-testid'))) {
                    return;
                }
                report(node, 'A `data-testid` selector in a spec (`querySelector`, `evaluate`, `$$`). Reach the element through the generated page objects; to read the DOM, pass their locator to `evaluate`.');
            },
        };
    },
};
