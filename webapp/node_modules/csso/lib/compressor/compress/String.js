module.exports = function(node) {
    var value = node.value;

    // remove escaped \n, i.e.
    // .a { content: "foo\
    // bar"}
    // ->
    // .a { content: "foobar" }
    value = value.replace(/\\\n/g, '');

    node.value = value;
};
