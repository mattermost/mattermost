// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';

export default class LineChart extends React.Component {
    constructor(props) {
        super(props);

        this.initChart = this.initChart.bind(this);
        this.chart = null;
    }

    componentDidMount() {
        this.initChart();
    }

    componentDidUpdate() {
        if (this.chart) {
            this.chart.destroy();
        }
        this.initChart();
    }

    componentWillUnmount() {
        if (this.chart) {
            this.chart.destroy();
        }
    }

    initChart() {
        if (!this.refs.canvas) {
            return;
        }
        var el = ReactDOM.findDOMNode(this.refs.canvas);
        var ctx = el.getContext('2d');
        this.chart = new Chart(ctx).Line(this.props.data, this.props.options || {}); //eslint-disable-line new-cap
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

