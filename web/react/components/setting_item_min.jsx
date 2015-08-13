// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    render: function() {
        var editButton = '';
        if(!this.props.disableOpen) {
            editButton = <li className="col-sm-2 section-edit"><a className="section-edit theme" href="#" onClick={this.props.updateSection}>Edit</a></li>;
        }
        return (
            <ul className="section-min">
                <li className="col-sm-10 section-title">{this.props.title}</li>
                {editButton}
                <li className="col-sm-7 section-describe">{this.props.describe}</li>
            </ul>
        );
    }
});
