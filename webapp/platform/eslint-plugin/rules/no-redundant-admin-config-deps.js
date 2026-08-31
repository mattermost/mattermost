// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Detects redundant System Console isDisabled conditions that are already
 * implied by a parent config setting dependency.
 *
 * When setting B declares `it.stateIsFalse('A')` (or equivalent) and A is a bool
 * setting that already disables itself under condition C, repeating C on B is
 * redundant and can drift when A's dependencies change.
 *
 * Inheritance only follows bool parents: disabled bools are forced false on
 * save (see getSettingValue), so stateIsFalse(parent) covers the parent's
 * config checks. File/text parents can remain truthy while disabled, so their
 * checks are not treated as transitive.
 *
 * The dependency tree is built fully before reporting. When a setting lists
 * both a parent and a grandparent, redundant conditions are attributed to the
 * closest (most specific) bool parent — not whichever ancestor appears first
 * in the isDisabled list.
 *
 * Only config/state helpers are considered (stateIsFalse/True/Equals/...,
 * configIsFalse/True, …). Permission and license checks are left alone —
 * non-bool children still need their own permission gates.
 */

const CONFIG_HELPERS = new Set([
    'stateIsFalse',
    'stateIsTrue',
    'stateEquals',
    'stateEqualsOrDefault',
    'stateMatches',
    'configIsFalse',
    'configIsTrue',
    'configContains',
    'clientConfigIsTrue',
    'clientConfigIsFalse',
]);

function isItMemberCall(node, name) {
    return (
        node?.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        !node.callee.computed &&
        node.callee.object?.type === 'Identifier' &&
        node.callee.object.name === 'it' &&
        node.callee.property?.type === 'Identifier' &&
        (name === undefined || node.callee.property.name === name)
    );
}

function literalValue(node) {
    if (!node) {
        return undefined;
    }
    if (node.type === 'Literal') {
        return node.value;
    }
    if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
        return node.quasis[0]?.value?.cooked;
    }
    return undefined;
}

function serializeArg(node) {
    // Regex literals must be keyed by pattern+flags. literalValue returns a
    // RegExp whose JSON.stringify is "{}", which would collapse distinct patterns.
    if (node?.type === 'Literal' && node.regex) {
        return `re:${JSON.stringify(node.regex.pattern)}:${JSON.stringify(node.regex.flags)}`;
    }

    const value = literalValue(node);
    if (value === undefined) {
        if (node?.type === 'Identifier') {
            return `id:${node.name}`;
        }
        if (node?.type === 'MemberExpression') {
            return `mem:${serializeArg(node.object)}.${node.property?.name ?? '?'}`;
        }
        if (node?.type === 'UnaryExpression' && node.operator === '!' && node.argument?.type === 'Literal') {
            return `!${JSON.stringify(node.argument.value)}`;
        }
        return null;
    }
    return JSON.stringify(value);
}

function canonicalize(node) {
    if (!node) {
        return null;
    }

    if (isItMemberCall(node, 'not') && node.arguments.length === 1) {
        const inner = canonicalize(node.arguments[0]);
        return inner ? `not:${inner}` : null;
    }

    if (!isItMemberCall(node) || node.arguments.length === 0) {
        return null;
    }

    const name = node.callee.property.name;
    if (!CONFIG_HELPERS.has(name)) {
        return null;
    }

    const args = node.arguments.map(serializeArg);
    if (args.some((a) => a === null)) {
        return null;
    }

    return `${name}:${args.join(',')}`;
}

function collectTopLevelConditions(node, out) {
    if (!node) {
        return;
    }

    if (isItMemberCall(node, 'any')) {
        for (const arg of node.arguments) {
            collectTopLevelConditions(arg, out);
        }
        return;
    }

    const key = canonicalize(node);
    if (key) {
        out.push({key, node});
    }
}

function getProperty(objectExpression, name) {
    if (objectExpression?.type !== 'ObjectExpression') {
        return null;
    }
    for (const prop of objectExpression.properties) {
        if (prop.type !== 'Property' || prop.computed) {
            continue;
        }
        const keyName = getPropertyKeyName(prop.key);
        if (keyName === name) {
            return prop;
        }
    }
    return null;
}

function getPropertyKeyName(keyNode) {
    if (keyNode.type === 'Identifier') {
        return keyNode.name;
    }
    if (keyNode.type === 'Literal') {
        return keyNode.value;
    }
    return null;
}

function getSettingKey(objectExpression) {
    const keyProp = getProperty(objectExpression, 'key');
    if (!keyProp) {
        return null;
    }
    return literalValue(keyProp.value);
}

function getSettingType(objectExpression) {
    const typeProp = getProperty(objectExpression, 'type');
    if (!typeProp) {
        return null;
    }
    return literalValue(typeProp.value);
}

function parseSerializedStringArg(serialized) {
    try {
        const value = JSON.parse(serialized);
        return typeof value === 'string' ? value : undefined;
    } catch {
        return undefined;
    }
}

function dependencyParentKeys(conditions) {
    const parents = [];
    for (const {key} of conditions) {
        // stateIsFalse:"Section.Setting" or not:stateIsTrue:"Section.Setting"
        let match = (/^stateIsFalse:(.*)$/).exec(key);
        if (match) {
            const value = parseSerializedStringArg(match[1]);
            if (value !== undefined) {
                parents.push(value);
            }
            continue;
        }
        match = (/^not:stateIsTrue:(.*)$/).exec(key);
        if (match) {
            const value = parseSerializedStringArg(match[1]);
            if (value !== undefined) {
                parents.push(value);
            }
        }
    }
    return parents;
}

function isBoolSetting(key, settingsByKey) {
    const defs = settingsByKey.get(key) || [];
    return defs.some((def) => def.settingType === 'bool');
}

/**
 * Build the full bool-parent dependency tree once, then derive inherited
 * condition sets. Reporting uses this snapshot so parent attribution does not
 * depend on isDisabled declaration order.
 *
 * @returns {Map<string, {
 *   isBool: boolean,
 *   directConditions: Set<string>,
 *   boolParents: string[],
 *   inheritedConditions: Set<string>,
 *   ancestors: Set<string>,
 * }>}
 */
function buildDependencyTree(settingsByKey) {
    const tree = new Map();

    for (const [key, defs] of settingsByKey) {
        const directConditions = new Set();
        const parentKeys = [];
        let isBool = false;

        for (const def of defs) {
            if (def.settingType === 'bool') {
                isBool = true;
            }
            for (const {key: conditionKey} of def.conditions) {
                directConditions.add(conditionKey);
            }
            for (const parentKey of def.parentKeys) {
                if (!parentKeys.includes(parentKey)) {
                    parentKeys.push(parentKey);
                }
            }
        }

        tree.set(key, {
            isBool,
            directConditions,
            boolParents: parentKeys.filter((parentKey) => isBoolSetting(parentKey, settingsByKey)),
            inheritedConditions: new Set(),
            ancestors: new Set(),
        });
    }

    const walked = new Set();

    function walk(settingKey, visiting) {
        const node = tree.get(settingKey);
        if (!node || walked.has(settingKey)) {
            return node;
        }
        if (visiting.has(settingKey)) {
            return node;
        }
        visiting.add(settingKey);

        const inheritedConditions = new Set();
        const ancestors = new Set();

        for (const parentKey of node.boolParents) {
            ancestors.add(parentKey);
            const parentNode = walk(parentKey, visiting);
            if (!parentNode) {
                continue;
            }
            for (const conditionKey of parentNode.directConditions) {
                inheritedConditions.add(conditionKey);
            }
            for (const conditionKey of parentNode.inheritedConditions) {
                inheritedConditions.add(conditionKey);
            }
            for (const ancestorKey of parentNode.ancestors) {
                ancestors.add(ancestorKey);
            }
        }

        node.inheritedConditions = inheritedConditions;
        node.ancestors = ancestors;
        walked.add(settingKey);
        visiting.delete(settingKey);
        return node;
    }

    for (const key of tree.keys()) {
        walk(key, new Set());
    }

    return tree;
}

function nodeImpliesCondition(node, conditionKey) {
    return node.directConditions.has(conditionKey) || node.inheritedConditions.has(conditionKey);
}

/**
 * Among immediate bool parents that imply the condition, pick the closest /
 * most specific one: a parent that is a descendant of another candidate wins
 * over that ancestor. Declaration order is ignored.
 */
function closestImplyingParent(settingKey, conditionKey, tree) {
    const node = tree.get(settingKey);
    if (!node) {
        return null;
    }

    const candidates = node.boolParents.filter((parentKey) => {
        const parentNode = tree.get(parentKey);
        return parentNode && nodeImpliesCondition(parentNode, conditionKey);
    });

    if (candidates.length === 0) {
        return null;
    }

    return candidates.reduce((best, candidate) => {
        const bestNode = tree.get(best);
        const candidateNode = tree.get(candidate);

        // Prefer the candidate that is under the current best (more specific).
        if (candidateNode.ancestors.has(best)) {
            return candidate;
        }

        // Keep best when it is under the candidate.
        if (bestNode.ancestors.has(candidate)) {
            return best;
        }

        // Disjoint parents that both imply the condition: stable tie-break by key.
        return candidate < best ? candidate : best;
    });
}

export default {
    meta: {
        type: 'problem',
        docs: {
            description: 'Disallow System Console isDisabled conditions already implied by a parent config dependency',
        },
        schema: [],
        messages: {
            redundant:
                "Redundant isDisabled condition '{{condition}}' on '{{setting}}' — already implied by dependency on '{{parent}}'. Depend on the parent setting and omit duplicated config checks.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename();
        if (!(/admin_definition/).test(filename)) {
            return {};
        }

        const settings = [];

        return {
            ObjectExpression(node) {
                const settingKey = getSettingKey(node);
                if (typeof settingKey !== 'string' || !settingKey.includes('.')) {
                    return;
                }

                const settingType = getSettingType(node);
                if (typeof settingType !== 'string') {
                    return;
                }

                const isDisabledProp = getProperty(node, 'isDisabled');
                if (!isDisabledProp) {
                    return;
                }

                const conditions = [];
                collectTopLevelConditions(isDisabledProp.value, conditions);
                if (conditions.length === 0) {
                    return;
                }

                settings.push({
                    key: settingKey,
                    settingType,
                    conditions,
                    parentKeys: dependencyParentKeys(conditions),
                    node,
                });
            },

            'Program:exit'() {
                const settingsByKey = new Map();
                for (const setting of settings) {
                    if (!settingsByKey.has(setting.key)) {
                        settingsByKey.set(setting.key, []);
                    }
                    settingsByKey.get(setting.key).push(setting);
                }

                // Build the complete tree before attributing any parent.
                const tree = buildDependencyTree(settingsByKey);

                for (const setting of settings) {
                    const node = tree.get(setting.key);
                    if (!node || node.boolParents.length === 0 || node.inheritedConditions.size === 0) {
                        continue;
                    }

                    for (const {key, node: conditionNode} of setting.conditions) {
                        if (!node.inheritedConditions.has(key)) {
                            continue;
                        }

                        const implyingParent = closestImplyingParent(setting.key, key, tree);
                        if (!implyingParent) {
                            continue;
                        }

                        context.report({
                            node: conditionNode,
                            messageId: 'redundant',
                            data: {
                                condition: key,
                                setting: setting.key,
                                parent: implyingParent,
                            },
                        });
                    }
                }
            },
        };
    },
};
