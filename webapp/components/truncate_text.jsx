import React from 'react';

export default class TruncateText extends React.Component {
    render() {
        const {length, children} = this.props;
        const truncatedText = this.truncateText({length, text: children});
        return (
            <span
                title={children}
                className='truncate-text__wrap'
            >
                {truncatedText}
            </span>
        );
    }

    truncateText(options) {
        const {
            length,
            text
        } = options;
        let result = '';
        if (text && length < text.length) {
            const halfTruncated = length / 2;
            result = text.substr(0, halfTruncated) + '...' + text.substr(-halfTruncated);
        } else {
            result = text + '\n';
        }
        while (result.length < length) {
            result += ' ';
        }
        return result;
    }
}

TruncateText.propTypes = {
    length: React.PropTypes.number,
    children: React.PropTypes.node
};
