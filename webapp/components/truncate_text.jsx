import React from 'react';

export default class TruncateText extends React.Component {
    render() {
        const {length, children} = this.props;
        const truncatedText = this.truncateText({length, text: children});
        return (<span title={children}>{truncatedText}</span>);
    }

    truncateText(options) {
        const {
            length,
            text
        } = options;

        if (text && length < text.length) {
            const halfTruncated = length / 2;
            return text.substr(0, halfTruncated) + '...' + text.substr(-halfTruncated);
        }
        return text;
    }
}

TruncateText.propTypes = {
    length: React.PropTypes.number,
    children: React.PropTypes.node
};
