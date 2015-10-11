// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

var TextFormatting = require('../utils/text_formatting.jsx');

export default class MessageWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        if (this.props.message) {
            return <div dangerouslySetInnerHTML={{__html: TextFormatting.formatText(this.props.message, this.props.options)}}/>;
        }

        return <div/>;
    }
}

MessageWrapper.defaultProps = {
    message: ''
};
MessageWrapper.propTypes = {
    message: React.PropTypes.string,
    options: React.PropTypes.object
};
