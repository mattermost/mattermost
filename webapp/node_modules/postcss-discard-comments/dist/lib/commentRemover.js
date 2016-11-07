'use strict';

exports.__esModule = true;
function CommentRemover(options) {
    this.options = options;
}

CommentRemover.prototype.canRemove = function (comment) {
    var remove = this.options.remove;
    if (remove) {
        return remove(comment);
    } else {
        var isImportant = comment.indexOf('!') === 0;
        if (!isImportant) {
            return true;
        } else if (isImportant) {
            if (this.options.removeAll || this._hasFirst) {
                return true;
            } else if (this.options.removeAllButFirst && !this._hasFirst) {
                this._hasFirst = true;
                return false;
            }
        }
    }
};

exports.default = CommentRemover;
module.exports = exports['default'];