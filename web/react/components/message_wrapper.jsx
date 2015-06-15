// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var utils = require('../utils/utils.jsx');

module.exports = React.createClass({
    render: function() {
        if (this.props.message) {
            var inner = utils.textToJsx(this.props.message, this.props.options);
            return (
                <div>{inner}</div>
            );
        } else {
            return <div/>
        }
    }
});
