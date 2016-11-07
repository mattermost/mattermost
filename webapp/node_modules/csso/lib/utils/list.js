//
//            item        item        item        item
//          /------\    /------\    /------\    /------\
//          | data |    | data |    | data |    | data |
//  null <--+-prev |<---+-prev |<---+-prev |<---+-prev |
//          | next-+--->| next-+--->| next-+--->| next-+--> null
//          \------/    \------/    \------/    \------/
//             ^                                    ^
//             |                list                |
//             |              /------\              |
//             \--------------+-head |              |
//                            | tail-+--------------/
//                            \------/
//

function createItem(data) {
    return {
        data: data,
        next: null,
        prev: null
    };
}

var List = function(values) {
    this.cursor = null;
    this.head = null;
    this.tail = null;

    if (Array.isArray(values)) {
        var cursor = null;

        for (var i = 0; i < values.length; i++) {
            var item = createItem(values[i]);

            if (cursor !== null) {
                cursor.next = item;
            } else {
                this.head = item;
            }

            item.prev = cursor;
            cursor = item;
        }

        this.tail = cursor;
    }
};

Object.defineProperty(List.prototype, 'size', {
    get: function() {
        var size = 0;
        var cursor = this.head;

        while (cursor) {
            size++;
            cursor = cursor.next;
        }

        return size;
    }
});

List.createItem = createItem;
List.prototype.createItem = createItem;

List.prototype.toArray = function() {
    var cursor = this.head;
    var result = [];

    while (cursor) {
        result.push(cursor.data);
        cursor = cursor.next;
    }

    return result;
};
List.prototype.toJSON = function() {
    return this.toArray();
};

List.prototype.isEmpty = function() {
    return this.head === null;
};

List.prototype.first = function() {
    return this.head && this.head.data;
};

List.prototype.last = function() {
    return this.tail && this.tail.data;
};

List.prototype.each = function(fn, context) {
    var item;
    var cursor = {
        prev: null,
        next: this.head,
        cursor: this.cursor
    };

    if (context === undefined) {
        context = this;
    }

    // push cursor
    this.cursor = cursor;

    while (cursor.next !== null) {
        item = cursor.next;
        cursor.next = item.next;

        fn.call(context, item.data, item, this);
    }

    // pop cursor
    this.cursor = this.cursor.cursor;
};

List.prototype.eachRight = function(fn, context) {
    var item;
    var cursor = {
        prev: this.tail,
        next: null,
        cursor: this.cursor
    };

    if (context === undefined) {
        context = this;
    }

    // push cursor
    this.cursor = cursor;

    while (cursor.prev !== null) {
        item = cursor.prev;
        cursor.prev = item.prev;

        fn.call(context, item.data, item, this);
    }

    // pop cursor
    this.cursor = this.cursor.cursor;
};

List.prototype.nextUntil = function(start, fn, context) {
    if (start === null) {
        return;
    }

    var item;
    var cursor = {
        prev: null,
        next: start,
        cursor: this.cursor
    };

    if (context === undefined) {
        context = this;
    }

    // push cursor
    this.cursor = cursor;

    while (cursor.next !== null) {
        item = cursor.next;
        cursor.next = item.next;

        if (fn.call(context, item.data, item, this)) {
            break;
        }
    }

    // pop cursor
    this.cursor = this.cursor.cursor;
};

List.prototype.prevUntil = function(start, fn, context) {
    if (start === null) {
        return;
    }

    var item;
    var cursor = {
        prev: start,
        next: null,
        cursor: this.cursor
    };

    if (context === undefined) {
        context = this;
    }

    // push cursor
    this.cursor = cursor;

    while (cursor.prev !== null) {
        item = cursor.prev;
        cursor.prev = item.prev;

        if (fn.call(context, item.data, item, this)) {
            break;
        }
    }

    // pop cursor
    this.cursor = this.cursor.cursor;
};

List.prototype.some = function(fn, context) {
    var cursor = this.head;

    if (context === undefined) {
        context = this;
    }

    while (cursor !== null) {
        if (fn.call(context, cursor.data, cursor, this)) {
            return true;
        }

        cursor = cursor.next;
    }

    return false;
};

List.prototype.map = function(fn, context) {
    var result = [];
    var cursor = this.head;

    if (context === undefined) {
        context = this;
    }

    while (cursor !== null) {
        result.push(fn.call(context, cursor.data, cursor, this));
        cursor = cursor.next;
    }

    return result;
};

List.prototype.copy = function() {
    var result = new List();
    var cursor = this.head;

    while (cursor !== null) {
        result.insert(createItem(cursor.data));
        cursor = cursor.next;
    }

    return result;
};

List.prototype.updateCursors = function(prevOld, prevNew, nextOld, nextNew) {
    var cursor = this.cursor;

    while (cursor !== null) {
        if (prevNew === true || cursor.prev === prevOld) {
            cursor.prev = prevNew;
        }

        if (nextNew === true || cursor.next === nextOld) {
            cursor.next = nextNew;
        }

        cursor = cursor.cursor;
    }
};

List.prototype.insert = function(item, before) {
    if (before !== undefined && before !== null) {
        // prev   before
        //      ^
        //     item
        this.updateCursors(before.prev, item, before, item);

        if (before.prev === null) {
            // insert to the beginning of list
            if (this.head !== before) {
                throw new Error('before doesn\'t below to list');
            }

            // since head points to before therefore list doesn't empty
            // no need to check tail
            this.head = item;
            before.prev = item;
            item.next = before;

            this.updateCursors(null, item);
        } else {

            // insert between two items
            before.prev.next = item;
            item.prev = before.prev;

            before.prev = item;
            item.next = before;
        }
    } else {
        // tail
        //      ^
        //     item
        this.updateCursors(this.tail, item, null, item);

        // insert to end of the list
        if (this.tail !== null) {
            // if list has a tail, then it also has a head, but head doesn't change

            // last item -> new item
            this.tail.next = item;

            // last item <- new item
            item.prev = this.tail;
        } else {
            // if list has no a tail, then it also has no a head
            // in this case points head to new item
            this.head = item;
        }

        // tail always start point to new item
        this.tail = item;
    }
};

List.prototype.remove = function(item) {
    //      item
    //       ^
    // prev     next
    this.updateCursors(item, item.prev, item, item.next);

    if (item.prev !== null) {
        item.prev.next = item.next;
    } else {
        if (this.head !== item) {
            throw new Error('item doesn\'t below to list');
        }

        this.head = item.next;
    }

    if (item.next !== null) {
        item.next.prev = item.prev;
    } else {
        if (this.tail !== item) {
            throw new Error('item doesn\'t below to list');
        }

        this.tail = item.prev;
    }

    item.prev = null;
    item.next = null;

    return item;
};

List.prototype.appendList = function(list) {
    // ignore empty lists
    if (list.head === null) {
        return;
    }

    this.updateCursors(this.tail, list.tail, null, list.head);

    // insert to end of the list
    if (this.tail !== null) {
        // if destination list has a tail, then it also has a head,
        // but head doesn't change

        // dest tail -> source head
        this.tail.next = list.head;

        // dest tail <- source head
        list.head.prev = this.tail;
    } else {
        // if list has no a tail, then it also has no a head
        // in this case points head to new item
        this.head = list.head;
    }

    // tail always start point to new item
    this.tail = list.tail;

    list.head = null;
    list.tail = null;
};

module.exports = List;
