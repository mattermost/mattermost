// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'react-intl';

import * as Utils from 'utils/utils.jsx';

import React from 'react';
import ReactDOM from 'react-dom';
import Chart from 'chart.js';

export default class LineChart extends React.Component {
    constructor(props) {
        super(props);

        this.initChart = this.initChart.bind(this);
        this.chart = null;
    }

    componentDidMount() {
        this.initChart();
    }

    componentDidUpdate(prevProps) {
        if (!Utils.areObjectsEqual(prevProps.data, this.props.data) || !Utils.areObjectsEqual(prevProps.options, this.props.options)) {
            this.initChart(true);
        }
    }

    componentWillUnmount() {
        if (this.chart && this.refs.canvas) {
            this.chart.destroy();
        }
    }

    initChart(update) {
        if (!this.refs.canvas) {
            return;
        }
        var el = ReactDOM.findDOMNode(this.refs.canvas);
        var ctx = el.getContext('2d');
        this.chart = new Chart(ctx, {type: 'line', data: this.props.data, options: this.props.options || {}}); //eslint-disable-line new-cap
        if (update) {
            this.chart.update();
        }
    }

    render() {
        let content;
        if (this.props.data == null) {
            content = (
                <FormattedMessage
                    id='analytics.chart.loading'
                    defaultMessage='Loading...'
                />
            );
        } else if (this.props.data.labels.length === 0) {
            content = (
                <h5>
                    <FormattedMessage
                        id='analytics.chart.meaningful'
                        defaultMessage='Not enough data for a meaningful representation.'
                    />
                </h5>
            );
        } else {
            content = (
                <canvas
                    ref='canvas'
                    width={this.props.width}
                    height={this.props.height}
                />
            );
        }

        return (
            <div className='col-sm-12'>
                <div className='total-count by-day'>
                    <div className='title'>
                        {this.props.title}
                    </div>
                    <div className='content'>
                        {content}
                    </div>
                </div>
            </div>
        );
    }
}

LineChart.propTypes = {
    title: React.PropTypes.node.isRequired,
    width: React.PropTypes.string.isRequired,
    height: React.PropTypes.string.isRequired,
    data: React.PropTypes.object,
    options: React.PropTypes.object
};

