// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
var UserStore = require('../stores/user_store.jsx');

export default class Mention extends React.Component {
    constructor(props) {
        super(props);

        this.handleClick = this.handleClick.bind(this);

        this.state = null;
    }
    handleClick() {
        this.props.handleClick(this.props.username);
    }
    render() {
        var icon;
        var timestamp = UserStore.getCurrentUser().update_at;
        if (this.props.id === 'allmention' || this.props.id === 'channelmention') {
            icon = <span><i className='mention-img fa fa-users fa-2x'></i></span>;
        } else if (this.props.id == null) {
            icon = <span><i className='mention-img fa fa-users fa-2x'></i></span>;
        } else {
            icon = (
                <span>
                    <img
                        className='mention-img'
                        src={'/api/v1/users/' + this.props.id + '/image?time=' + timestamp}
                    />
                </span>
            );
        }
        return (
            <div
                className={'mentions-name ' + this.props.isFocused}
                id={this.props.id + '_mentions'}
                onClick={this.handleClick}
                onMouseEnter={this.props.handleMouseEnter}
            >
                <div className='pull-left'>{icon}</div>
                <div className='pull-left mention-align'><span>@{this.props.username}</span><span className='mention-fullname'>{this.props.secondary_text}</span></div>
            </div>
        );
    }
}

Mention.defaultProps = {
    username: '',
    id: '',
    isFocused: '',
    secondary_text: ''
};
Mention.propTypes = {
    handleClick: React.PropTypes.func.isRequired,
    handleMouseEnter: React.PropTypes.func.isRequired,
    username: React.PropTypes.string,
    id: React.PropTypes.string,
    isFocused: React.PropTypes.string,
    secondary_text: React.PropTypes.string
};
