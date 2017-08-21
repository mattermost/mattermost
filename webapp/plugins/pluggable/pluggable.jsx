// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// EXPERIMENTAL - SUBJECT TO CHANGE

import React from 'react';
import PropTypes from 'prop-types';

export default class Pluggable extends React.PureComponent {
    static propTypes = {

        /*
         * Should be a single overridable React component
         */
        children: PropTypes.element.isRequired,

        /*
         * Components for overriding provided by plugins
         */
        components: PropTypes.object.isRequired,

        /*
         * Logged in user's theme
         */
        theme: PropTypes.object.isRequired
    }

    render() {
        const child = React.Children.only(this.props.children).type;
        const components = this.props.components;

        if (child == null) {
            return null;
        }

        // Include any props passed to this component or to the child component
        let props = {...this.props};
        Reflect.deleteProperty(props, 'children');
        Reflect.deleteProperty(props, 'components');
        props = {...props, ...this.props.children.props};

        // Override the default component with any registered plugin's component
        if (components.hasOwnProperty(child.name)) {
            const PluginComponent = components[child.name];
            return (
                <PluginComponent
                    {...props}
                    theme={this.props.theme}
                />
            );
        }

        return React.cloneElement(this.props.children, {...props});
    }
}
