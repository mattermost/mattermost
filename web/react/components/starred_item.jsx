// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import PreferenceStore from '../stores/preference_store.jsx';
import * as Client from '../utils/client.jsx';

export default class StarredItem extends React.Component {
    constructor(props) {
        super(props);

        this.onClick = this.onClick.bind(this);
        this.onChange = this.onChange.bind(this);
        this.getPreference = this.getPreference.bind(this);

        this.willUnmount = false;
        this.state = {isStarred: this.getPreference()};
    }

    componentDidMount() {
        PreferenceStore.addChangeListener(this.onChange);
    }

    componentWillUnmount() {
        this.willUnmount = true;
        PreferenceStore.removeChangeListener(this.onChange);
    }

    getPreference() {
        return Boolean(PreferenceStore.getPreference(this.props.type, this.props.id, {value: false}).value);
    }

    onChange() {
        if (!this.willUnmount) {
            this.setState({isStarred: this.getPreference()});
        }
    }

    onClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const preference = PreferenceStore.setPreference(
            this.props.type,
            this.props.id,
            this.state.isStarred ? '' : 'true'
        );

        Client.savePreferences([preference],
            () => {
                this.setState({isStarred: !this.state.isStarred});
                PreferenceStore.emitChange([preference]);
            },
            () => {}
        );
    }

    render() {
        let starClass = 'fa-star-o';
        if (this.state.isStarred) {
            starClass = 'fa-star';
        }

        let activeClass = '';
        if (this.state.isStarred) {
            activeClass = 'starred-item--active';
        }

        return (
            <div className={'starred-item ' + activeClass}>
                <i
                    onClick={this.onClick}
                    className={'fa ' + starClass}
                />
            </div>
        );
    }
}

StarredItem.propTypes = {
    id: React.PropTypes.string.isRequired,
    type: React.PropTypes.string.isRequired
};
