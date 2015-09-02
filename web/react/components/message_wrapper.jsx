// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var Utils = require('../utils/utils.jsx');

export default class MessageWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        if (this.props.message) {
            var inner = Utils.textToJsx(this.props.message, this.props.options);
            return (
                <div>{inner}</div>
            );
        }

        return <div/>;
    }
}

MessageWrapper.defaultProps = {
    message: null,
    options: null
};
MessageWrapper.propTypes = {
    message: React.PropTypes.string,
    options: React.PropTypes.object
};
