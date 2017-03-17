'use strict';

exports.__esModule = true;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var clone = function clone(obj, parent) {
    if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object' || obj === null) {
        return obj;
    }
    var cloned = new obj.constructor();
    for (var i in obj) {
        if (!{}.hasOwnProperty.call(obj, i)) {
            continue;
        }
        var value = obj[i];
        if (i === 'parent' && (typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
            if (parent) {
                cloned[i] = parent;
            }
        } else if (i === 'source') {
            cloned[i] = value;
        } else if (value instanceof Array) {
            cloned[i] = value.map(function (j) {
                return clone(j, cloned);
            });
        } else {
            cloned[i] = clone(value, cloned);
        }
    }
    return cloned;
};

exports.default = clone;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9saWIvY2xvbmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsSUFBTSxRQUFRLFNBQVIsS0FBUSxDQUFDLEdBQUQsRUFBTSxNQUFOLEVBQWlCO0FBQzNCLFFBQUksUUFBTyxHQUFQLHlDQUFPLEdBQVAsT0FBZSxRQUFmLElBQTJCLFFBQVEsSUFBdkMsRUFBNkM7QUFDekMsZUFBTyxHQUFQO0FBQ0g7QUFDRCxRQUFNLFNBQVMsSUFBSSxJQUFJLFdBQVIsRUFBZjtBQUNBLFNBQUssSUFBSSxDQUFULElBQWMsR0FBZCxFQUFtQjtBQUNmLFlBQUksQ0FBRSxHQUFHLGNBQUgsQ0FBa0IsSUFBbEIsQ0FBdUIsR0FBdkIsRUFBNEIsQ0FBNUIsQ0FBTixFQUF1QztBQUNuQztBQUNIO0FBQ0QsWUFBSSxRQUFRLElBQUksQ0FBSixDQUFaO0FBQ0EsWUFBSSxNQUFNLFFBQU4sSUFBa0IsUUFBTyxLQUFQLHlDQUFPLEtBQVAsT0FBaUIsUUFBdkMsRUFBaUQ7QUFDN0MsZ0JBQUksTUFBSixFQUFZO0FBQ1IsdUJBQU8sQ0FBUCxJQUFZLE1BQVo7QUFDSDtBQUNKLFNBSkQsTUFJTyxJQUFJLE1BQU0sUUFBVixFQUFvQjtBQUN2QixtQkFBTyxDQUFQLElBQVksS0FBWjtBQUNILFNBRk0sTUFFQSxJQUFJLGlCQUFpQixLQUFyQixFQUE0QjtBQUMvQixtQkFBTyxDQUFQLElBQVksTUFBTSxHQUFOLENBQVU7QUFBQSx1QkFBSyxNQUFNLENBQU4sRUFBUyxNQUFULENBQUw7QUFBQSxhQUFWLENBQVo7QUFDSCxTQUZNLE1BRUE7QUFDSCxtQkFBTyxDQUFQLElBQVksTUFBTSxLQUFOLEVBQWEsTUFBYixDQUFaO0FBQ0g7QUFDSjtBQUNELFdBQU8sTUFBUDtBQUNILENBdkJEOztrQkF5QmUsSyIsImZpbGUiOiJjbG9uZS5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGNsb25lID0gKG9iaiwgcGFyZW50KSA9PiB7XG4gICAgaWYgKHR5cGVvZiBvYmogIT09ICdvYmplY3QnIHx8IG9iaiA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm4gb2JqO1xuICAgIH1cbiAgICBjb25zdCBjbG9uZWQgPSBuZXcgb2JqLmNvbnN0cnVjdG9yKCk7XG4gICAgZm9yIChsZXQgaSBpbiBvYmopIHtcbiAgICAgICAgaWYgKCEoe30uaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGkpKSkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHZhbHVlID0gb2JqW2ldO1xuICAgICAgICBpZiAoaSA9PT0gJ3BhcmVudCcgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgaWYgKHBhcmVudCkge1xuICAgICAgICAgICAgICAgIGNsb25lZFtpXSA9IHBhcmVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIGlmIChpID09PSAnc291cmNlJykge1xuICAgICAgICAgICAgY2xvbmVkW2ldID0gdmFsdWU7XG4gICAgICAgIH0gZWxzZSBpZiAodmFsdWUgaW5zdGFuY2VvZiBBcnJheSkge1xuICAgICAgICAgICAgY2xvbmVkW2ldID0gdmFsdWUubWFwKGogPT4gY2xvbmUoaiwgY2xvbmVkKSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjbG9uZWRbaV0gPSBjbG9uZSh2YWx1ZSwgY2xvbmVkKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gY2xvbmVkO1xufTtcblxuZXhwb3J0IGRlZmF1bHQgY2xvbmU7XG4iXX0=