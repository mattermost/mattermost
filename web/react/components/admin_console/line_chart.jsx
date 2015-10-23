// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

export default class LineChart extends React.Component {
    constructor(props) {
        super(props);

        this.initChart = this.initChart.bind(this);
        this.chart = null;
    }

    componentDidMount() {
        this.initChart(this.props);
    }

    componentWillReceiveProps(nextProps) {
        if (this.chart) {
            this.chart.destroy();
            this.initChart(nextProps);
        }
    }

    componentWillUnmount() {
        if (this.chart) {
            this.chart.destroy();
        }
    }

    initChart(props) {
        var el = ReactDOM.findDOMNode(this);
        var ctx = el.getContext('2d');
        this.chart = new Chart(ctx).Line(props.data, props.options || {}); //eslint-disable-line new-cap
    }

    render() {
        return (
            <canvas
                width={this.props.width}
                height={this.props.height}
            />
        );
    }
}

LineChart.propTypes = {
    width: React.PropTypes.string,
    height: React.PropTypes.string,
    data: React.PropTypes.object,
    options: React.PropTypes.object
};
