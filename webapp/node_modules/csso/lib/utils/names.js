var hasOwnProperty = Object.prototype.hasOwnProperty;
var knownKeywords = Object.create(null);
var knownProperties = Object.create(null);

function getVendorPrefix(string) {
    if (string[0] === '-') {
        // skip 2 chars to avoid wrong match with variables names
        var secondDashIndex = string.indexOf('-', 2);

        if (secondDashIndex !== -1) {
            return string.substr(0, secondDashIndex + 1);
        }
    }

    return '';
}

function getKeywordInfo(keyword) {
    if (hasOwnProperty.call(knownKeywords, keyword)) {
        return knownKeywords[keyword];
    }

    var lowerCaseKeyword = keyword.toLowerCase();
    var vendor = getVendorPrefix(lowerCaseKeyword);
    var name = lowerCaseKeyword;

    if (vendor) {
        name = name.substr(vendor.length);
    }

    return knownKeywords[keyword] = Object.freeze({
        vendor: vendor,
        prefix: vendor,
        name: name
    });
}

function getPropertyInfo(property) {
    if (hasOwnProperty.call(knownProperties, property)) {
        return knownProperties[property];
    }

    var lowerCaseProperty = property.toLowerCase();
    var hack = lowerCaseProperty[0];

    if (hack === '*' || hack === '_' || hack === '$') {
        lowerCaseProperty = lowerCaseProperty.substr(1);
    } else if (hack === '/' && property[1] === '/') {
        hack = '//';
        lowerCaseProperty = lowerCaseProperty.substr(2);
    } else {
        hack = '';
    }

    var vendor = getVendorPrefix(lowerCaseProperty);
    var name = lowerCaseProperty;

    if (vendor) {
        name = name.substr(vendor.length);
    }

    return knownProperties[property] = Object.freeze({
        hack: hack,
        vendor: vendor,
        prefix: hack + vendor,
        name: name
    });
}

module.exports = {
    keyword: getKeywordInfo,
    property: getPropertyInfo
};
