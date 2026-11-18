import React from 'react';

function Row({id}: {id: string}) {
    return <div data-testid={`values.setting:${id}--region`} role='region'>
        <input id={id} data-testid='values.setting.value--textbox'/>
    </div>;
}

export function Settings() {
    return <>
        <Row id='ServiceSettings.SiteURL'/>
        <Row id='GitLabSettings.Url'/>
        <Row id='LdapSettings.TestConnection'/>
        <Row id='bannerEnabled'/>
        <Row id='openidType'/>
    </>;
}
