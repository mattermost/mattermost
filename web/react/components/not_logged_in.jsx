// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {FormattedMessage} from 'mm-intl';

export default class NotLoggedIn extends React.Component {
    componentDidMount() {
        $('body').attr('class', 'white');
        $('#root').attr('class', 'container-fluid');
    }
    componentWillUnmount() {
        $('body').attr('class', '');
        $('#root').attr('class', '');
    }
    render() {
        return (
            <div className='inner__wrap'>
                <div className='row content'>
                    {this.props.children}
                    <div className='footer-push'></div>
                </div>
                <div className='row footer'>
                    <div className='footer-pane col-xs-12'>
                        <div className='col-xs-12'>
                            <span className='pull-right footer-site-name'>{global.window.mm_config.SiteName}</span>
                        </div>
                        <div className='col-xs-12'>
                            <span className='pull-right footer-link copyright'>{'© 2015 Mattermost, Inc.'}</span>
                            <a
                                id='help_link'
                                className='pull-right footer-link'
                                href={global.window.mm_config.HelpLink}
                            >
                                <FormattedMessage id='web.footer.help'/>
                            </a>
                            <a
                                id='terms_link'
                                className='pull-right footer-link'
                                href={global.window.mm_config.TermsOfServiceLink}
                            >
                                <FormattedMessage id='web.footer.terms'/>
                            </a>
                            <a
                                id='privacy_link'
                                className='pull-right footer-link'
                                href={global.window.mm_config.PrivacyPolicyLink}
                            >
                                <FormattedMessage id='web.footer.privacy'/>
                            </a>
                            <a
                                id='about_link'
                                className='pull-right footer-link'
                                href={global.window.mm_config.AboutLink}
                            >
                                <FormattedMessage id='web.footer.about'/>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

NotLoggedIn.defaultProps = {
};

NotLoggedIn.propTypes = {
    children: React.PropTypes.object
};
