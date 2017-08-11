// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// EXPERIMENTAL - SUBJECT TO CHANGE

import React from 'react';
import PropTypes from 'prop-types';

export default class Pluggable extends React.PureComponent {
    static propTypes = {
        children: PropTypes.element.isRequired
    }

    render() {
        const child = this.props.children.type;

        if (child == null) {
            return null;
        }

        // Include any props passed to this component or to the child component
        const props = {...this.props, ...this.props.children.props};
        Reflect.deleteProperty(props, 'children');

        // Override the default component with any registered plugin's component
        if (global.window.plugins.components.hasOwnProperty(child.name)) {
            const PluginComponent = global.window.plugins.components[child.name];
            return <PluginComponent {...props}/>;
        }

        return <child {...props}/>;
    }
}
