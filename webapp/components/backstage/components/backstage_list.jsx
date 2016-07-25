// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import * as Utils from 'utils/utils.jsx';

import {Link} from 'react-router';
import LoadingScreen from 'components/loading_screen.jsx';

export default class BackstageList extends React.Component {
    static propTypes = {
        children: React.PropTypes.node,
        header: React.PropTypes.node.isRequired,
        addLink: React.PropTypes.string,
        addText: React.PropTypes.node,
        emptyText: React.PropTypes.node,
        helpText: React.PropTypes.node,
        loading: React.PropTypes.bool.isRequired,
        searchPlaceholder: React.PropTypes.string
    }

    static defaultProps = {
        searchPlaceholder: Utils.localizeMessage('backstage.search', 'Search')
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

            if (children.length === 0 && this.props.emptyText) {
                children = (
                    <span className='backstage-list__item backstage-list__empty'>
                        {this.props.emptyText}
                    </span>
                );
            }
        }

        let addLink = null;
        if (this.props.addLink && this.props.addText) {
            addLink = (
                <Link
                    className='add-link'
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
            );
        }

        return (
            <div className='backstage-content'>
                <div className='backstage-header'>
                    <h1>
                        {this.props.header}
                    </h1>
                    {addLink}
                </div>
                <div className='backstage-filters'>
                    <div className='backstage-filter__search'>
                        <i className='fa fa-search'></i>
                        <input
                            type='search'
                            className='form-control'
                            placeholder={this.props.searchPlaceholder}
                            value={this.state.filter}
                            onChange={this.updateFilter}
                            style={{flexGrow: 0, flexShrink: 0}}
                        />
                    </div>
                </div>
                <span className='backstage-list__help'>
                    {this.props.helpText}
                </span>
                <div className='backstage-list'>
                    {children}
                </div>
            </div>
        );
    }
}
