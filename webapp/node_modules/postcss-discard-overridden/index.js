import postcss from 'postcss';

const OVERRIDABLE_RULES = ['keyframes', 'counter-style'];
const SCOPE_RULES = ['media', 'supports'];

function isOverridable(name) {
    return OVERRIDABLE_RULES.indexOf(postcss.vendor.unprefixed(name)) !== -1;
}

function isScope(name) {
    return SCOPE_RULES.indexOf(postcss.vendor.unprefixed(name)) !== -1;
}

function getScope(node) {
    let current = node.parent;
    let chain = [node.name, node.params];
    do {
        if (current.type === 'atrule' && isScope(current.name)) {
            chain.unshift(current.name + ' ' + current.params);
        }
        current = current.parent;
    } while (current);
    return chain.join('|');
}

export default postcss.plugin('postcss-discard-overridden', () => {
    return css => {
        let cache = {};
        let rules = [];
        css.walkAtRules(rule => {
            if (rule.type === 'atrule' && isOverridable(rule.name)) {
                let scope = getScope(rule);
                cache[scope] = rule;
                rules.push({
                    node: rule,
                    scope
                });
            }
        });
        rules.forEach(rule => {
            if (cache[rule.scope] !== rule.node) {
                rule.node.remove();
            }
        });
    };
});
