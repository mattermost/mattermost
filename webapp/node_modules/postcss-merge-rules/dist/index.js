'use strict';

exports.__esModule = true;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _vendors = require('vendors');

var _vendors2 = _interopRequireDefault(_vendors);

var _clone = require('./lib/clone');

var _clone2 = _interopRequireDefault(_clone);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var list = _postcss2.default.list;

var prefixes = _vendors2.default.map(function (v) {
    return '-' + v + '-';
});

function intersect(a, b, not) {
    return a.filter(function (c) {
        var index = ~b.indexOf(c);
        return not ? !index : index;
    });
}

var different = function different(a, b) {
    return intersect(a, b, true).concat(intersect(b, a, true));
};
var filterPrefixes = function filterPrefixes(selector) {
    return intersect(prefixes, selector);
};

function sameVendor(selectorsA, selectorsB) {
    var same = function same(selectors) {
        return selectors.map(filterPrefixes).join();
    };
    return same(selectorsA) === same(selectorsB);
}

var noVendor = function noVendor(selector) {
    return !filterPrefixes(selector).length;
};

function sameParent(ruleA, ruleB) {
    var hasParent = ruleA.parent && ruleB.parent;
    var sameType = hasParent && ruleA.parent.type === ruleB.parent.type;
    // If an at rule, ensure that the parameters are the same
    if (hasParent && ruleA.parent.type !== 'root' && ruleB.parent.type !== 'root') {
        sameType = sameType && ruleA.parent.params === ruleB.parent.params && ruleA.parent.name === ruleB.parent.name;
    }
    return hasParent ? sameType : true;
}

function canMerge(ruleA, ruleB) {
    var a = list.comma(ruleA.selector);
    var b = list.comma(ruleB.selector);

    var parent = sameParent(ruleA, ruleB);
    var name = ruleA.parent.name;

    if (parent && name && ~name.indexOf('keyframes')) {
        return false;
    }
    return parent && (a.concat(b).every(noVendor) || sameVendor(a, b));
}

var getDecls = function getDecls(rule) {
    return rule.nodes ? rule.nodes.map(String) : [];
};
var joinSelectors = function joinSelectors() {
    for (var _len = arguments.length, rules = Array(_len), _key = 0; _key < _len; _key++) {
        rules[_key] = arguments[_key];
    }

    return rules.map(function (s) {
        return s.selector;
    }).join();
};

function ruleLength() {
    for (var _len2 = arguments.length, rules = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        rules[_key2] = arguments[_key2];
    }

    return rules.map(function (r) {
        return r.nodes.length ? String(r) : '';
    }).join('').length;
}

function splitProp(prop) {
    var parts = prop.split('-');
    var base = void 0,
        rest = void 0;
    // Treat vendor prefixed properties as if they were unprefixed;
    // moving them when combined with non-prefixed properties can
    // cause issues. e.g. moving -webkit-background-clip when there
    // is a background shorthand definition.
    if (prop[0] === '-') {
        base = parts[2];
        rest = parts.slice(3);
    } else {
        base = parts[0];
        rest = parts.slice(1);
    }
    return [base, rest];
}

function isConflictingProp(propA, propB) {
    if (propA === propB) {
        return true;
    }
    var a = splitProp(propA);
    var b = splitProp(propB);
    return a[0] === b[0] && a[1].length !== b[1].length;
}

function hasConflicts(declProp, notMoved) {
    return notMoved.some(function (prop) {
        return isConflictingProp(prop, declProp);
    });
}

function partialMerge(first, second) {
    var _this = this;

    var intersection = intersect(getDecls(first), getDecls(second));
    if (!intersection.length) {
        return second;
    }
    var nextRule = second.next();
    if (nextRule && nextRule.type === 'rule' && canMerge(second, nextRule)) {
        var nextIntersection = intersect(getDecls(second), getDecls(nextRule));
        if (nextIntersection.length > intersection.length) {
            first = second;second = nextRule;intersection = nextIntersection;
        }
    }
    var recievingBlock = (0, _clone2.default)(second);
    recievingBlock.selector = joinSelectors(first, second);
    recievingBlock.nodes = [];
    second.parent.insertBefore(second, recievingBlock);
    var difference = different(getDecls(first), getDecls(second));
    var filterConflicts = function filterConflicts(decls, intersectn) {
        var willNotMove = [];
        return decls.reduce(function (willMove, decl) {
            var intersects = ~intersectn.indexOf(decl);
            var prop = decl.split(':')[0];
            var base = prop.split('-')[0];
            var canMove = difference.every(function (d) {
                return d.split(':')[0] !== base;
            });
            if (intersects && canMove && !hasConflicts(prop, willNotMove)) {
                willMove.push(decl);
            } else {
                willNotMove.push(prop);
            }
            return willMove;
        }, []);
    };
    intersection = filterConflicts(getDecls(first).reverse(), intersection);
    intersection = filterConflicts(getDecls(second), intersection);
    var firstClone = (0, _clone2.default)(first);
    var secondClone = (0, _clone2.default)(second);
    var moveDecl = function moveDecl(callback) {
        return function (decl) {
            if (~intersection.indexOf(String(decl))) {
                callback.call(_this, decl);
            }
        };
    };
    firstClone.walkDecls(moveDecl(function (decl) {
        decl.remove();
        recievingBlock.append(decl);
    }));
    secondClone.walkDecls(moveDecl(function (decl) {
        return decl.remove();
    }));
    var merged = ruleLength(firstClone, recievingBlock, secondClone);
    var original = ruleLength(first, second);
    if (merged < original) {
        first.replaceWith(firstClone);
        second.replaceWith(secondClone);
        [firstClone, recievingBlock, secondClone].forEach(function (r) {
            if (!r.nodes.length) {
                r.remove();
            }
        });
        if (!secondClone.parent) {
            return recievingBlock;
        }
        return secondClone;
    } else {
        recievingBlock.remove();
        return second;
    }
}

function selectorMerger() {
    var cache = null;
    return function (rule) {
        // Prime the cache with the first rule, or alternately ensure that it is
        // safe to merge both declarations before continuing
        if (!cache || !canMerge(rule, cache)) {
            cache = rule;
            return;
        }
        // Ensure that we don't deduplicate the same rule; this is sometimes
        // caused by a partial merge
        if (cache === rule) {
            cache = rule;
            return;
        }
        // Merge when declarations are exactly equal
        // e.g. h1 { color: red } h2 { color: red }
        if (getDecls(rule).join(';') === getDecls(cache).join(';')) {
            rule.selector = joinSelectors(cache, rule);
            cache.remove();
            cache = rule;
            return;
        }
        // Merge when both selectors are exactly equal
        // e.g. a { color: blue } a { font-weight: bold }
        if (cache.selector === rule.selector) {
            var _ret = function () {
                var toString = String(cache);
                rule.walk(function (decl) {
                    if (~toString.indexOf(String(decl))) {
                        return decl.remove();
                    }
                    decl.moveTo(cache);
                });
                rule.remove();
                return {
                    v: void 0
                };
            }();

            if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
        }
        // Partial merge: check if the rule contains a subset of the last; if
        // so create a joined selector with the subset, if smaller.
        cache = partialMerge(cache, rule);
    };
}

exports.default = _postcss2.default.plugin('postcss-merge-rules', function () {
    return function (css) {
        return css.walkRules(selectorMerger());
    };
});
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,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Q0Esb0JBQVEsSUFBUjtBQUNBO0FBQ0g7OztBQUdELFlBQUksTUFBTSxRQUFOLEtBQW1CLEtBQUssUUFBNUIsRUFBc0M7QUFBQTtBQUNsQyxvQkFBTSxXQUFXLE9BQU8sS0FBUCxDQUFqQjtBQUNBLHFCQUFLLElBQUwsQ0FBVSxnQkFBUTtBQUNkLHdCQUFJLENBQUMsU0FBUyxPQUFULENBQWlCLE9BQU8sSUFBUCxDQUFqQixDQUFMLEVBQXFDO0FBQ2pDLCtCQUFPLEtBQUssTUFBTCxFQUFQO0FBQ0g7QUFDRCx5QkFBSyxNQUFMLENBQVksS0FBWjtBQUNILGlCQUxEO0FBTUEscUJBQUssTUFBTDtBQUNBO0FBQUE7QUFBQTtBQVRrQzs7QUFBQTtBQVVyQzs7O0FBR0QsZ0JBQVEsYUFBYSxLQUFiLEVBQW9CLElBQXBCLENBQVI7QUFDSCxLQXJDRDtBQXNDSDs7a0JBRWMsa0JBQVEsTUFBUixDQUFlLHFCQUFmLEVBQXNDLFlBQU07QUFDdkQsV0FBTztBQUFBLGVBQU8sSUFBSSxTQUFKLENBQWMsZ0JBQWQsQ0FBUDtBQUFBLEtBQVA7QUFDSCxDQUZjLEMiLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgcG9zdGNzcyBmcm9tICdwb3N0Y3NzJztcbmltcG9ydCB2ZW5kb3JzIGZyb20gJ3ZlbmRvcnMnO1xuaW1wb3J0IGNsb25lIGZyb20gJy4vbGliL2Nsb25lJztcblxuY29uc3Qge2xpc3R9ID0gcG9zdGNzcztcbmNvbnN0IHByZWZpeGVzID0gdmVuZG9ycy5tYXAodiA9PiBgLSR7dn0tYCk7XG5cbmZ1bmN0aW9uIGludGVyc2VjdCAoYSwgYiwgbm90KSB7XG4gICAgcmV0dXJuIGEuZmlsdGVyKGMgPT4ge1xuICAgICAgICBjb25zdCBpbmRleCA9IH5iLmluZGV4T2YoYyk7XG4gICAgICAgIHJldHVybiBub3QgPyAhaW5kZXggOiBpbmRleDtcbiAgICB9KTtcbn1cblxuY29uc3QgZGlmZmVyZW50ID0gKGEsIGIpID0+IGludGVyc2VjdChhLCBiLCB0cnVlKS5jb25jYXQoaW50ZXJzZWN0KGIsIGEsIHRydWUpKTtcbmNvbnN0IGZpbHRlclByZWZpeGVzID0gc2VsZWN0b3IgPT4gaW50ZXJzZWN0KHByZWZpeGVzLCBzZWxlY3Rvcik7XG5cbmZ1bmN0aW9uIHNhbWVWZW5kb3IgKHNlbGVjdG9yc0EsIHNlbGVjdG9yc0IpIHtcbiAgICBsZXQgc2FtZSA9IHNlbGVjdG9ycyA9PiBzZWxlY3RvcnMubWFwKGZpbHRlclByZWZpeGVzKS5qb2luKCk7XG4gICAgcmV0dXJuIHNhbWUoc2VsZWN0b3JzQSkgPT09IHNhbWUoc2VsZWN0b3JzQik7XG59XG5cbmNvbnN0IG5vVmVuZG9yID0gc2VsZWN0b3IgPT4gIWZpbHRlclByZWZpeGVzKHNlbGVjdG9yKS5sZW5ndGg7XG5cbmZ1bmN0aW9uIHNhbWVQYXJlbnQgKHJ1bGVBLCBydWxlQikge1xuICAgIGNvbnN0IGhhc1BhcmVudCA9IHJ1bGVBLnBhcmVudCAmJiBydWxlQi5wYXJlbnQ7XG4gICAgbGV0IHNhbWVUeXBlID0gaGFzUGFyZW50ICYmIHJ1bGVBLnBhcmVudC50eXBlID09PSBydWxlQi5wYXJlbnQudHlwZTtcbiAgICAvLyBJZiBhbiBhdCBydWxlLCBlbnN1cmUgdGhhdCB0aGUgcGFyYW1ldGVycyBhcmUgdGhlIHNhbWVcbiAgICBpZiAoaGFzUGFyZW50ICYmIHJ1bGVBLnBhcmVudC50eXBlICE9PSAncm9vdCcgJiYgcnVsZUIucGFyZW50LnR5cGUgIT09ICdyb290Jykge1xuICAgICAgICBzYW1lVHlwZSA9IHNhbWVUeXBlICYmXG4gICAgICAgICAgICAgICAgICAgcnVsZUEucGFyZW50LnBhcmFtcyA9PT0gcnVsZUIucGFyZW50LnBhcmFtcyAmJlxuICAgICAgICAgICAgICAgICAgIHJ1bGVBLnBhcmVudC5uYW1lID09PSBydWxlQi5wYXJlbnQubmFtZTtcbiAgICB9XG4gICAgcmV0dXJuIGhhc1BhcmVudCA/IHNhbWVUeXBlIDogdHJ1ZTtcbn1cblxuZnVuY3Rpb24gY2FuTWVyZ2UgKHJ1bGVBLCBydWxlQikge1xuICAgIGNvbnN0IGEgPSBsaXN0LmNvbW1hKHJ1bGVBLnNlbGVjdG9yKTtcbiAgICBjb25zdCBiID0gbGlzdC5jb21tYShydWxlQi5zZWxlY3Rvcik7XG5cbiAgICBjb25zdCBwYXJlbnQgPSBzYW1lUGFyZW50KHJ1bGVBLCBydWxlQik7XG4gICAgY29uc3Qge25hbWV9ID0gcnVsZUEucGFyZW50O1xuICAgIGlmIChwYXJlbnQgJiYgbmFtZSAmJiB+bmFtZS5pbmRleE9mKCdrZXlmcmFtZXMnKSkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIHJldHVybiBwYXJlbnQgJiYgKGEuY29uY2F0KGIpLmV2ZXJ5KG5vVmVuZG9yKSB8fCBzYW1lVmVuZG9yKGEsIGIpKTtcbn1cblxuY29uc3QgZ2V0RGVjbHMgPSBydWxlID0+IHJ1bGUubm9kZXMgPyBydWxlLm5vZGVzLm1hcChTdHJpbmcpIDogW107XG5jb25zdCBqb2luU2VsZWN0b3JzID0gKC4uLnJ1bGVzKSA9PiBydWxlcy5tYXAocyA9PiBzLnNlbGVjdG9yKS5qb2luKCk7XG5cbmZ1bmN0aW9uIHJ1bGVMZW5ndGggKC4uLnJ1bGVzKSB7XG4gICAgcmV0dXJuIHJ1bGVzLm1hcChyID0+IHIubm9kZXMubGVuZ3RoID8gU3RyaW5nKHIpIDogJycpLmpvaW4oJycpLmxlbmd0aDtcbn1cblxuZnVuY3Rpb24gc3BsaXRQcm9wIChwcm9wKSB7XG4gICAgY29uc3QgcGFydHMgPSBwcm9wLnNwbGl0KCctJyk7XG4gICAgbGV0IGJhc2UsIHJlc3Q7XG4gICAgLy8gVHJlYXQgdmVuZG9yIHByZWZpeGVkIHByb3BlcnRpZXMgYXMgaWYgdGhleSB3ZXJlIHVucHJlZml4ZWQ7XG4gICAgLy8gbW92aW5nIHRoZW0gd2hlbiBjb21iaW5lZCB3aXRoIG5vbi1wcmVmaXhlZCBwcm9wZXJ0aWVzIGNhblxuICAgIC8vIGNhdXNlIGlzc3Vlcy4gZS5nLiBtb3ZpbmcgLXdlYmtpdC1iYWNrZ3JvdW5kLWNsaXAgd2hlbiB0aGVyZVxuICAgIC8vIGlzIGEgYmFja2dyb3VuZCBzaG9ydGhhbmQgZGVmaW5pdGlvbi5cbiAgICBpZiAocHJvcFswXSA9PT0gJy0nKSB7XG4gICAgICAgIGJhc2UgPSBwYXJ0c1syXTtcbiAgICAgICAgcmVzdCA9IHBhcnRzLnNsaWNlKDMpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIGJhc2UgPSBwYXJ0c1swXTtcbiAgICAgICAgcmVzdCA9IHBhcnRzLnNsaWNlKDEpO1xuICAgIH1cbiAgICByZXR1cm4gW2Jhc2UsIHJlc3RdO1xufVxuXG5mdW5jdGlvbiBpc0NvbmZsaWN0aW5nUHJvcCAocHJvcEEsIHByb3BCKSB7XG4gICAgaWYgKHByb3BBID09PSBwcm9wQikge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgY29uc3QgYSA9IHNwbGl0UHJvcChwcm9wQSk7XG4gICAgY29uc3QgYiA9IHNwbGl0UHJvcChwcm9wQik7XG4gICAgcmV0dXJuIGFbMF0gPT09IGJbMF0gJiYgYVsxXS5sZW5ndGggIT09IGJbMV0ubGVuZ3RoO1xufVxuXG5mdW5jdGlvbiBoYXNDb25mbGljdHMgKGRlY2xQcm9wLCBub3RNb3ZlZCkge1xuICAgIHJldHVybiBub3RNb3ZlZC5zb21lKHByb3AgPT4gaXNDb25mbGljdGluZ1Byb3AocHJvcCwgZGVjbFByb3ApKTtcbn1cblxuZnVuY3Rpb24gcGFydGlhbE1lcmdlIChmaXJzdCwgc2Vjb25kKSB7XG4gICAgbGV0IGludGVyc2VjdGlvbiA9IGludGVyc2VjdChnZXREZWNscyhmaXJzdCksIGdldERlY2xzKHNlY29uZCkpO1xuICAgIGlmICghaW50ZXJzZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gc2Vjb25kO1xuICAgIH1cbiAgICBsZXQgbmV4dFJ1bGUgPSBzZWNvbmQubmV4dCgpO1xuICAgIGlmIChuZXh0UnVsZSAmJiBuZXh0UnVsZS50eXBlID09PSAncnVsZScgJiYgY2FuTWVyZ2Uoc2Vjb25kLCBuZXh0UnVsZSkpIHtcbiAgICAgICAgbGV0IG5leHRJbnRlcnNlY3Rpb24gPSBpbnRlcnNlY3QoZ2V0RGVjbHMoc2Vjb25kKSwgZ2V0RGVjbHMobmV4dFJ1bGUpKTtcbiAgICAgICAgaWYgKG5leHRJbnRlcnNlY3Rpb24ubGVuZ3RoID4gaW50ZXJzZWN0aW9uLmxlbmd0aCkge1xuICAgICAgICAgICAgZmlyc3QgPSBzZWNvbmQ7IHNlY29uZCA9IG5leHRSdWxlOyBpbnRlcnNlY3Rpb24gPSBuZXh0SW50ZXJzZWN0aW9uO1xuICAgICAgICB9XG4gICAgfVxuICAgIGNvbnN0IHJlY2lldmluZ0Jsb2NrID0gY2xvbmUoc2Vjb25kKTtcbiAgICByZWNpZXZpbmdCbG9jay5zZWxlY3RvciA9IGpvaW5TZWxlY3RvcnMoZmlyc3QsIHNlY29uZCk7XG4gICAgcmVjaWV2aW5nQmxvY2subm9kZXMgPSBbXTtcbiAgICBzZWNvbmQucGFyZW50Lmluc2VydEJlZm9yZShzZWNvbmQsIHJlY2lldmluZ0Jsb2NrKTtcbiAgICBjb25zdCBkaWZmZXJlbmNlID0gZGlmZmVyZW50KGdldERlY2xzKGZpcnN0KSwgZ2V0RGVjbHMoc2Vjb25kKSk7XG4gICAgY29uc3QgZmlsdGVyQ29uZmxpY3RzID0gKGRlY2xzLCBpbnRlcnNlY3RuKSA9PiB7XG4gICAgICAgIGxldCB3aWxsTm90TW92ZSA9IFtdO1xuICAgICAgICByZXR1cm4gZGVjbHMucmVkdWNlKCh3aWxsTW92ZSwgZGVjbCkgPT4ge1xuICAgICAgICAgICAgbGV0IGludGVyc2VjdHMgPSB+aW50ZXJzZWN0bi5pbmRleE9mKGRlY2wpO1xuICAgICAgICAgICAgbGV0IHByb3AgPSBkZWNsLnNwbGl0KCc6JylbMF07XG4gICAgICAgICAgICBsZXQgYmFzZSA9IHByb3Auc3BsaXQoJy0nKVswXTtcbiAgICAgICAgICAgIGxldCBjYW5Nb3ZlID0gZGlmZmVyZW5jZS5ldmVyeShkID0+IGQuc3BsaXQoJzonKVswXSAhPT0gYmFzZSk7XG4gICAgICAgICAgICBpZiAoaW50ZXJzZWN0cyAmJiBjYW5Nb3ZlICYmICFoYXNDb25mbGljdHMocHJvcCwgd2lsbE5vdE1vdmUpKSB7XG4gICAgICAgICAgICAgICAgd2lsbE1vdmUucHVzaChkZWNsKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgd2lsbE5vdE1vdmUucHVzaChwcm9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB3aWxsTW92ZTtcbiAgICAgICAgfSwgW10pO1xuICAgIH07XG4gICAgaW50ZXJzZWN0aW9uID0gZmlsdGVyQ29uZmxpY3RzKGdldERlY2xzKGZpcnN0KS5yZXZlcnNlKCksIGludGVyc2VjdGlvbik7XG4gICAgaW50ZXJzZWN0aW9uID0gZmlsdGVyQ29uZmxpY3RzKChnZXREZWNscyhzZWNvbmQpKSwgaW50ZXJzZWN0aW9uKTtcbiAgICBjb25zdCBmaXJzdENsb25lID0gY2xvbmUoZmlyc3QpO1xuICAgIGNvbnN0IHNlY29uZENsb25lID0gY2xvbmUoc2Vjb25kKTtcbiAgICBjb25zdCBtb3ZlRGVjbCA9IGNhbGxiYWNrID0+IHtcbiAgICAgICAgcmV0dXJuIGRlY2wgPT4ge1xuICAgICAgICAgICAgaWYgKH5pbnRlcnNlY3Rpb24uaW5kZXhPZihTdHJpbmcoZGVjbCkpKSB7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2suY2FsbCh0aGlzLCBkZWNsKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9O1xuICAgIGZpcnN0Q2xvbmUud2Fsa0RlY2xzKG1vdmVEZWNsKGRlY2wgPT4ge1xuICAgICAgICBkZWNsLnJlbW92ZSgpO1xuICAgICAgICByZWNpZXZpbmdCbG9jay5hcHBlbmQoZGVjbCk7XG4gICAgfSkpO1xuICAgIHNlY29uZENsb25lLndhbGtEZWNscyhtb3ZlRGVjbChkZWNsID0+IGRlY2wucmVtb3ZlKCkpKTtcbiAgICBjb25zdCBtZXJnZWQgPSBydWxlTGVuZ3RoKGZpcnN0Q2xvbmUsIHJlY2lldmluZ0Jsb2NrLCBzZWNvbmRDbG9uZSk7XG4gICAgY29uc3Qgb3JpZ2luYWwgPSBydWxlTGVuZ3RoKGZpcnN0LCBzZWNvbmQpO1xuICAgIGlmIChtZXJnZWQgPCBvcmlnaW5hbCkge1xuICAgICAgICBmaXJzdC5yZXBsYWNlV2l0aChmaXJzdENsb25lKTtcbiAgICAgICAgc2Vjb25kLnJlcGxhY2VXaXRoKHNlY29uZENsb25lKTtcbiAgICAgICAgW2ZpcnN0Q2xvbmUsIHJlY2lldmluZ0Jsb2NrLCBzZWNvbmRDbG9uZV0uZm9yRWFjaChyID0+IHtcbiAgICAgICAgICAgIGlmICghci5ub2Rlcy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICByLnJlbW92ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCFzZWNvbmRDbG9uZS5wYXJlbnQpIHtcbiAgICAgICAgICAgIHJldHVybiByZWNpZXZpbmdCbG9jaztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2Vjb25kQ2xvbmU7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmVjaWV2aW5nQmxvY2sucmVtb3ZlKCk7XG4gICAgICAgIHJldHVybiBzZWNvbmQ7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBzZWxlY3Rvck1lcmdlciAoKSB7XG4gICAgbGV0IGNhY2hlID0gbnVsbDtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHJ1bGUpIHtcbiAgICAgICAgLy8gUHJpbWUgdGhlIGNhY2hlIHdpdGggdGhlIGZpcnN0IHJ1bGUsIG9yIGFsdGVybmF0ZWx5IGVuc3VyZSB0aGF0IGl0IGlzXG4gICAgICAgIC8vIHNhZmUgdG8gbWVyZ2UgYm90aCBkZWNsYXJhdGlvbnMgYmVmb3JlIGNvbnRpbnVpbmdcbiAgICAgICAgaWYgKCFjYWNoZSB8fCAhY2FuTWVyZ2UocnVsZSwgY2FjaGUpKSB7XG4gICAgICAgICAgICBjYWNoZSA9IHJ1bGU7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgLy8gRW5zdXJlIHRoYXQgd2UgZG9uJ3QgZGVkdXBsaWNhdGUgdGhlIHNhbWUgcnVsZTsgdGhpcyBpcyBzb21ldGltZXNcbiAgICAgICAgLy8gY2F1c2VkIGJ5IGEgcGFydGlhbCBtZXJnZVxuICAgICAgICBpZiAoY2FjaGUgPT09IHJ1bGUpIHtcbiAgICAgICAgICAgIGNhY2hlID0gcnVsZTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAvLyBNZXJnZSB3aGVuIGRlY2xhcmF0aW9ucyBhcmUgZXhhY3RseSBlcXVhbFxuICAgICAgICAvLyBlLmcuIGgxIHsgY29sb3I6IHJlZCB9IGgyIHsgY29sb3I6IHJlZCB9XG4gICAgICAgIGlmIChnZXREZWNscyhydWxlKS5qb2luKCc7JykgPT09IGdldERlY2xzKGNhY2hlKS5qb2luKCc7JykpIHtcbiAgICAgICAgICAgIHJ1bGUuc2VsZWN0b3IgPSBqb2luU2VsZWN0b3JzKGNhY2hlLCBydWxlKTtcbiAgICAgICAgICAgIGNhY2hlLnJlbW92ZSgpO1xuICAgICAgICAgICAgY2FjaGUgPSBydWxlO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIE1lcmdlIHdoZW4gYm90aCBzZWxlY3RvcnMgYXJlIGV4YWN0bHkgZXF1YWxcbiAgICAgICAgLy8gZS5nLiBhIHsgY29sb3I6IGJsdWUgfSBhIHsgZm9udC13ZWlnaHQ6IGJvbGQgfVxuICAgICAgICBpZiAoY2FjaGUuc2VsZWN0b3IgPT09IHJ1bGUuc2VsZWN0b3IpIHtcbiAgICAgICAgICAgIGNvbnN0IHRvU3RyaW5nID0gU3RyaW5nKGNhY2hlKTtcbiAgICAgICAgICAgIHJ1bGUud2FsayhkZWNsID0+IHtcbiAgICAgICAgICAgICAgICBpZiAofnRvU3RyaW5nLmluZGV4T2YoU3RyaW5nKGRlY2wpKSkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZGVjbC5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZGVjbC5tb3ZlVG8oY2FjaGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBydWxlLnJlbW92ZSgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIC8vIFBhcnRpYWwgbWVyZ2U6IGNoZWNrIGlmIHRoZSBydWxlIGNvbnRhaW5zIGEgc3Vic2V0IG9mIHRoZSBsYXN0OyBpZlxuICAgICAgICAvLyBzbyBjcmVhdGUgYSBqb2luZWQgc2VsZWN0b3Igd2l0aCB0aGUgc3Vic2V0LCBpZiBzbWFsbGVyLlxuICAgICAgICBjYWNoZSA9IHBhcnRpYWxNZXJnZShjYWNoZSwgcnVsZSk7XG4gICAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgcG9zdGNzcy5wbHVnaW4oJ3Bvc3Rjc3MtbWVyZ2UtcnVsZXMnLCAoKSA9PiB7XG4gICAgcmV0dXJuIGNzcyA9PiBjc3Mud2Fsa1J1bGVzKHNlbGVjdG9yTWVyZ2VyKCkpO1xufSk7XG4iXX0=