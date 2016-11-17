// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import {FormattedMessage} from 'react-intl';
import {Link} from 'react-router';

import MattermostIcon from 'images/favicon/android-chrome-192x192.png';
import Nexus6Mockup from 'images/nexus-6p-mockup.png';

export default class GetAndroidApp extends React.Component {
  render() {
      return (
          <div className='get-app get-android-app'>
              <img src='https://s3.amazonaws.com/uber-test/uchat/uchat_color.png' className='centerMeImage' />
              <a className='btn btn-primary get-android-app__open-mattermost'       href='mattermost://' ><FormattedMessage id='get_app.openMattermost' defaultMessage='Open in uChat App' /></a>
              <a className='btn btn-primary get-android-app__continue-with-browser' href='mattermost://' ><FormattedMessage id='get_app.continueWithBrowserLink' defaultMessage='Continue to mobile site' /></a>
          </div>
      );
  }
}
