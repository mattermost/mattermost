// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

function blockList(line) {
    return line.startsWith('.focalboard-body') ||
        line.startsWith('.GlobalHeaderComponent') ||
        line.startsWith('.boards-rhs-icon') ||
        line.startsWith('.focalboard-plugin-root') ||
        line.startsWith('.FocalboardUnfurl') ||
        line.startsWith('.CreateBoardFromTemplate');
}

module.exports = function loader(source) {
    var newSource = [];
    source.split('\n').forEach((line) => {
        if ((line.startsWith('.') || line.startsWith('#')) && !blockList(line)) {
            newSource.push('.focalboard-body ' + line);
        } else {
            newSource.push(line);
        }
    });
    return newSource.join('\n');
};
