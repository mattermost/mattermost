module.exports = function cleanAtrule(node, item, list) {
    if (node.block) {
        // otherwise removed at-rule don't prevent @import for removal
        this.root.firstAtrulesAllowed = false;

        if (node.block.type === 'Block' && node.block.declarations.isEmpty()) {
            list.remove(item);
            return;
        }

        if (node.block.type === 'StyleSheet' && node.block.rules.isEmpty()) {
            list.remove(item);
            return;
        }
    }

    switch (node.name) {
        case 'charset':
            if (node.expression.sequence.isEmpty()) {
                list.remove(item);
                return;
            }

            // if there is any rule before @charset -> remove it
            if (item.prev) {
                list.remove(item);
                return;
            }

            break;

        case 'import':
            if (!this.root.firstAtrulesAllowed) {
                list.remove(item);
                return;
            }

            // if there are some rules that not an @import or @charset before @import
            // remove it
            list.prevUntil(item.prev, function(rule) {
                if (rule.type === 'Atrule') {
                    if (rule.name === 'import' || rule.name === 'charset') {
                        return;
                    }
                }

                this.root.firstAtrulesAllowed = false;
                list.remove(item);
                return true;
            }, this);

            break;
    }
};
