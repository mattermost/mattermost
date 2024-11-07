import { FormattedMessage } from 'react-intl';

// formatMessageWithoutExtraction is a helper function to format messages without triggering
// an error from Babel that messages must be statically evaluate-able for extraction.
const formatMessageWithoutExtraction = (intl, ...rest) => intl.formatMessage(...rest);

const FormattedMessageWithoutExtraction = (props) => <FormattedMessage {...props} />;

export {
    formatMessageWithoutExtraction,
    FormattedMessageWithoutExtraction,
}
