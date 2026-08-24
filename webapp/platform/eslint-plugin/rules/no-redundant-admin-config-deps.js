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
        if (node?.type === 'Literal' && node.regex) {
            return String(node.raw);
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
        const keyName =
            prop.key.type === 'Identifier' ? prop.key.name :
                prop.key.type === 'Literal' ? prop.key.value :
                    null;
        if (keyName === name) {
            return prop;
        }
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

function dependencyParentKeys(conditions) {
    const parents = [];
    for (const {key} of conditions) {
        // stateIsFalse:"Section.Setting" or not:stateIsTrue:"Section.Setting"
        let match = /^stateIsFalse:(.*)$/.exec(key);
        if (match) {
            const value = JSON.parse(match[1]);
            if (typeof value === 'string') {
                parents.push(value);
            }
            continue;
        }
        match = /^not:stateIsTrue:(.*)$/.exec(key);
        if (match) {
            const value = JSON.parse(match[1]);
            if (typeof value === 'string') {
                parents.push(value);
            }
        }
    }
    return parents;
}

function boolParentKeys(parentKeys, settingsByKey) {
    return parentKeys.filter((parentKey) => {
        const parentDefs = settingsByKey.get(parentKey) || [];
        return parentDefs.some((def) => def.settingType === 'bool');
    });
}

function inheritedConditionKeys(settingKey, settingsByKey, visiting = new Set()) {
    if (visiting.has(settingKey)) {
        return new Set();
    }
    visiting.add(settingKey);

    const inherited = new Set();
    const definitions = settingsByKey.get(settingKey) || [];
    for (const def of definitions) {
        for (const parentKey of boolParentKeys(def.parentKeys, settingsByKey)) {
            const parentDefs = settingsByKey.get(parentKey) || [];
            for (const parentDef of parentDefs) {
                for (const {key} of parentDef.conditions) {
                    inherited.add(key);
                }
            }
            for (const key of inheritedConditionKeys(parentKey, settingsByKey, visiting)) {
                inherited.add(key);
            }
        }
    }

    visiting.delete(settingKey);
    return inherited;
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
        if (!/admin_definition/.test(filename)) {
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

                for (const setting of settings) {
                    const parents = boolParentKeys(setting.parentKeys, settingsByKey);
                    if (parents.length === 0) {
                        continue;
                    }

                    const inherited = inheritedConditionKeys(setting.key, settingsByKey);
                    if (inherited.size === 0) {
                        continue;
                    }

                    for (const {key, node} of setting.conditions) {
                        if (!inherited.has(key)) {
                            continue;
                        }

                        let implyingParent = parents[0];
                        for (const parentKey of parents) {
                            const parentDefs = settingsByKey.get(parentKey) || [];
                            const parentHas = parentDefs.some((d) => d.conditions.some((c) => c.key === key));
                            const parentInherits = inheritedConditionKeys(parentKey, settingsByKey).has(key);
                            if (parentHas || parentInherits) {
                                implyingParent = parentKey;
                                break;
                            }
                        }

                        context.report({
                            node,
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
