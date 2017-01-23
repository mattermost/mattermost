import React from 'react';
import {Constants} from 'utils/constants.jsx';

export default class FileUploadProgress extends React.Component {
    shouldComponentUpdate(nextProps) {
        return this.props.percent !== nextProps.percent;
    }

    computePathString(radius, percent) {
        const len = Math.PI * 2 * radius;
        return {
            pathString: `M 50,        50 m 0,            -${radius}
                         a ${radius}, ${radius} 0 1 1 0,  ${2 * radius}
                         a ${radius}, ${radius} 0 1 1 0, -${2 * radius}`,
            pathStyle: {
                strokeDasharray: `${len}px ${len}px`,
                strokeDashoffset: `${((100 - percent) / 100) * len}px`
            }
        };
    }

    render() {
        const {
            prefixClass,
            strokeWidth,
            strokeColor,
            trailWidth,
            trailColor,
            strokeLinecap
        } = Constants.FileUploadProgress;
        const percent = Math.floor(this.props.percent || 0);
        const radius = 50 - (strokeWidth / 2);
        const {pathString, pathStyle} = this.computePathString(radius, percent);

        return (
            <svg
                className={`${prefixClass}__circle`}
                viewBox='0 0 100 100'
            >
                <path
                    className={`${prefixClass}__circle-trail`}
                    d={pathString}
                    stroke={trailColor}
                    strokeWidth={trailWidth || strokeWidth}
                    fillOpacity='0'
                />
                <path
                    className={`${prefixClass}__circle-path`}
                    d={pathString}
                    strokeLinecap={strokeLinecap}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    fillOpacity='0'
                    style={pathStyle}
                />
                <text
                    className={`${prefixClass}__inside-text`}
                    x='50%'
                    y='50%'
                    textAnchor='middle'
                    stroke='#00'
                    dy='.3em'
                >
                {`${percent}%`}
        </text>
            </svg>
        );
    }
}

FileUploadProgress.propTypes = {
    percent: React.PropTypes.number
};
