// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

module.exports = React.createClass({
    displayName: "LoadingScreen",
    propTypes: {
        position: React.PropTypes.oneOf(['absolute', 'fixed', 'relative', 'static', 'inherit'])
    },
    getDefaultProps: function() {
        return { position: 'relative' };
    },
    render: function() {
        return (
            <div className="loading-screen" style={{position: this.props.position}}>
                <div className="loading__content">
                    <h3>Loading</h3>
                    <div className="round round-1"></div>
                    <div className="round round-2"></div>
                    <div className="round round-3"></div>
                </div>
            </div>
        );
    }
});
