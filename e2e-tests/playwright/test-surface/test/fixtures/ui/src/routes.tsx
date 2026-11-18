import React from 'react';
import {Route, Switch} from 'react-router-dom';

import {Banner, Header} from './header';
import {Footer} from './modals';

const TEAM = '/:team([a-z0-9\\-_]+)';

function ChannelController() {
    return (
        <div>
            <Header channelId='c' isMobile={false}/>
            <Banner/>
        </div>
    );
}

function HelpController() {
    return <Footer/>;
}

function LoggedInRoute(props: {path: string; component: unknown}) {
    return <Route {...props}/>;
}

export function Root() {
    return (
        <Switch>
            <LoggedInRoute
                path={`${TEAM}/:path(channels|messages)/:identifier/:postid?`}
                component={ChannelController}
            />
            <Route
                path='/help/:page?'
                render={() => <HelpController/>}
            />
        </Switch>
    );
}
