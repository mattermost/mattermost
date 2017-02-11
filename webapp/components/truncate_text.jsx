import React from 'react';

export default class TruncateText extends React.Component {
    render() {
        const {type, length, children} = this.props;
        const truncatedText = this.truncateText({type, length, text: children});
        return (<span title={children}>{truncatedText}</span>);
    }

    truncateText(options) {
        const {
            length,
            text
        } = options;

        const halfTruncated = length / 2;
        return text.substr(0, halfTruncated) + '...' + text.substr(-halfTruncated);
    }
}
