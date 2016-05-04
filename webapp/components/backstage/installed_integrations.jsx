// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import {Link} from 'react-router';
import LoadingScreen from 'components/loading_screen.jsx';

export default class InstalledIntegrations extends React.Component {
    static get propTypes() {
        return {
            children: React.PropTypes.node,
            header: React.PropTypes.node.isRequired,
            addLink: React.PropTypes.string.isRequired,
            addText: React.PropTypes.node.isRequired,
            emptyText: React.PropTypes.node.isRequired,
            loading: React.PropTypes.bool.isRequired
        };
    }

    constructor(props) {
        super(props);

        this.updateFilter = this.updateFilter.bind(this);

        this.state = {
            filter: ''
        };
    }

    updateFilter(e) {
        this.setState({
            filter: e.target.value
        });
    }

    render() {
        const filter = this.state.filter.toLowerCase();

        let children;

        if (this.props.loading) {
            children = <LoadingScreen/>;
        } else {
            children = React.Children.map(this.props.children, (child) => {
                return React.cloneElement(child, {filter});
            });

            if (children.length === 0) {
                children = (
                    <span className='backstage-list__item backstage-list_empty'>
                        {this.props.emptyText}
                    </span>
                );
            }
        }

        return (
            <div className='backstage-content'>
                <div className='installed-integrations'>
                    <div className='backstage-header'>
                        <h1>
                            {this.props.header}
                        </h1>
                        <Link
                            className='add-integrations-link'
                            to={this.props.addLink}
                        >
                            <button
                                type='button'
                                className='btn btn-primary'
                            >
                                <span>
                                    {this.props.addText}
                                </span>
                            </button>
                        </Link>
                    </div>
                    <div className='backstage-filters'>
                        <div className='backstage-filter__search'>
                            <i className='fa fa-search'></i>
                            <input
                                type='search'
                                className='form-control'
                                placeholder={Utils.localizeMessage('installed_integrations.search', 'Search Integrations')}
                                value={this.state.filter}
                                onChange={this.updateFilter}
                                style={{flexGrow: 0, flexShrink: 0}}
                            />
                        </div>
                    </div>
                    <div className='backstage-list'>
                        {children}
                    </div>
                </div>
            </div>
        );
    }
}
