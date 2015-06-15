// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.


var utils = require('../utils/utils.jsx');
var UserStore = require('../stores/user_store.jsx');

function getStateFromStores(userId) {
    var profile = UserStore.getProfile(userId);

    if (profile == null) {
        return { profile: { id: "0", username: "..."} };
    }
    else {
        return { profile: profile };
    }
}

var id = 0;

function nextId() {
    id = id + 1;
    return id;
}


module.exports = React.createClass({
    uniqueId: null,
    componentDidMount: function() {
        UserStore.addChangeListener(this._onChange);
        $("#profile_" + this.uniqueId).popover({placement : 'right', container: 'body', trigger: 'hover', html: true, delay: { "show": 200, "hide": 100 }});
    },
    componentWillUnmount: function() {
        UserStore.removeChangeListener(this._onChange);
    },
    _onChange: function(id) {
        if (id == this.props.userId) {
            var newState = getStateFromStores(this.props.userId);
            if (!utils.areStatesEqual(newState, this.state)) {
                this.setState(newState);
            }
        }
    },
    componentWillReceiveProps: function(nextProps) {
        if (this.props.userId != nextProps.userId) {
            this.setState(getStateFromStores(nextProps.userId));
        }
    },
    getInitialState: function() {
        this.uniqueId = nextId();
        return getStateFromStores(this.props.userId);
    },
    render: function() {
        var name = this.props.overwriteName ? this.props.overwriteName : this.state.profile.username;


        var data_content = ""
        data_content += "<img style='margin: 10px' src='/api/v1/users/" + this.state.profile.id + "/image' height='128' width='128' />"
        if (!config.ShowEmail) {
            data_content += "<div><span style='white-space:nowrap;'>Email not shared</span></div>";
        } else {
            data_content += "<div><a href='mailto:'" + this.state.profile.email + "'' style='white-space:nowrap;text-transform:lowercase;'>" + this.state.profile.email + "</a></div>";
        }

        return (
            <div style={{"cursor" : "pointer", "display" : "inline-block"}} className="user-popover" id={"profile_" + this.uniqueId} data-toggle="popover" data-content={data_content} data-original-title={this.state.profile.username} >
                { name }
            </div>
        );
    }
});
