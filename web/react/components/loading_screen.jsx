// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.
import {intlShape, injectIntl, defineMessages} from 'react-intl';

const messages = defineMessages({
    loading: {
        id: 'loading_screen.loading',
        defaultMessage: 'Loading'
    }
});

class LoadingScreen extends React.Component {
    constructor(props) {
        super(props);
        this.state = {};
    }
    render() {
        const {formatMessage} = this.props.intl;
        return (
            <div
                className='loading-screen'
                style={{position: this.props.position}}
            >
                <div className='loading__content'>
                    <h3>{formatMessage(messages.loading)}</h3>
                    <div className='round round-1'></div>
                    <div className='round round-2'></div>
                    <div className='round round-3'></div>
                </div>
            </div>
        );
    }
}

LoadingScreen.defaultProps = {
    position: 'relative'
};
LoadingScreen.propTypes = {
    intl: intlShape.isRequired,
    position: React.PropTypes.oneOf(['absolute', 'fixed', 'relative', 'static', 'inherit'])
};

export default injectIntl(LoadingScreen);