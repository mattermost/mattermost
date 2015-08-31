// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var PasswordResetSendLink = require('./password_reset_send_link.jsx');
var PasswordResetForm = require('./password_reset_form.jsx');

export default class PasswordReset extends React.Component {
    constructor(props) {
        super(props);

        this.state = {};
    }
    render() {
        if (this.props.isReset === 'false') {
            return (
                <PasswordResetSendLink
                    teamDisplayName={this.props.teamDisplayName}
                    teamName={this.props.teamName}
                />
            );
        }

        return (
            <PasswordResetForm
                teamDisplayName={this.props.teamDisplayName}
                teamName={this.props.teamName}
                hash={this.props.hash}
                data={this.props.data}
            />
        );
    }
}

PasswordReset.defaultProps = {
    isReset: '',
    teamName: '',
    teamDisplayName: '',
    hash: '',
    data: ''
};
PasswordReset.propTypes = {
    isReset: React.PropTypes.string,
    teamName: React.PropTypes.string,
    teamDisplayName: React.PropTypes.string,
    hash: React.PropTypes.string,
    data: React.PropTypes.string
};
