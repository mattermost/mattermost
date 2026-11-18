// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {test} from 'node:test';

import {LIB, withProject} from './helpers.ts';

import {scanProject} from '../src/cli.ts';
import {loadConfig} from '../src/config.ts';

test('JSX-valued props are exclusive only at their receiver render positions', () => {
    withProject(['source.tsx', LIB], (root) => {
        const config = path.join(root, 'config.json');
        const cases = [
            ['exclusive', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', false],
            ['concurrent', 'return <>{max}<Min testId={testId}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['two_instances', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Max testId="settings.value"/>}/><Item testId="settings.value" max={<Max testId="settings.value"/>}/></>;', true],
            ['also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const content=<Max testId="settings.value"/>; return <>{content}<Item testId="settings.value" max={content}/></>;', true],
            ['literal_wrapped', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Manage/>}/>;', false],
            ['mixed_wrapped', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Manage/>}/>;', false],
            ['mixed_two_receivers', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Manage/>}/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['literal_escaped', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const routes=[{component:Manage}]; renderInner(routes); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_shorthand_escape', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const routes={Manage}; renderInner(routes); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_named_escape', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const routes={component:Manage}; renderInner(routes); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_publishing_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish<T>(Component:T):T{renderInner(Component);return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_shorthand_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish<T>(Component:T):T{renderInner({Component});return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_arguments_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish(Component:any){renderInner(arguments[0]);return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_alias_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function publish(Component:any){const C=Component;renderInner(C);return Component;} const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_produced_helper', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'function identity(Component:any){return Component;} declare function produce(x:any):any; const publish=produce(identity); const Alias=publish(Manage); return <Item testId="settings.value" max={<Manage/>}/>;', true],
            ['literal_wrapped_let', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'let content=null; if(active){content=<Manage/>;} return <Item testId="settings.value" max={content}/>;', false],
            ['literal_also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Manage/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['literal_two_receivers', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Manage/>}/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['wrapped_component', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <Item testId="settings.value" max={<Manage/>}/>;', false],
            ['wrapped_also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Manage/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['wrapped_two_receivers', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'return <><Item testId="settings.value" max={<Manage/>}/><Item testId="settings.value" max={<Manage/>}/></>;', true],
            ['conditional_let', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'let content=null; if(active){content=<Max testId="settings.value"/>;} return <Item testId="settings.value" max={content}/>;', false],
            ['let_also_direct', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'let content=null; if(active){content=<Max testId="settings.value"/>;} return <>{content}<Item testId="settings.value" max={content}/></>;', true],
            ['constant', 'if(active){return <>{max}</>;} return <Min testId={testId}/>;', 'const content=<Max testId="settings.value"/>; return <Item testId="settings.value" max={content}/>;', false],
            ['deferred', 'const render=()=> <>{max}</>; return <>{render()}<Min testId={testId}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['props_spread', 'PROPS:if(active){return <>{props.max}</>;} return <><Min testId={props.testId}/><Other {...props}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['rest_spread', 'REST:if(active){return <>{rest.max}</>;} return <><Min testId={testId}/><Other {...rest}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['computed_read', 'PROPS:if(active){return <>{props.max}</>;} return <><Min testId={props.testId}/>{props[dynamicKey]}</>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['props_helper', 'PROPS:if(active){return <>{props.max}</>;} return <><Min testId={props.testId}/>{renderInner(props)}</>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['spread_forward', 'const props={max,testId}; if(active){return <>{max}</>;} return <><Min testId={testId}/><Other {...props}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
            ['forwarded', 'return <><Other content={max}/><Min testId={testId}/></>;', 'return <Item testId="settings.value" max={<Max testId="settings.value"/>}/>;', true],
        ] as const;
        for (const [label, body, app, duplicate] of cases) {
            let parameter = '{max,testId}';
            if (body.startsWith('PROPS:')) {
                parameter = 'props';
            } else if (body.startsWith('REST:')) {
                parameter = '{testId,...rest}';
            }
            let manage = '';
            if (app.includes('<Manage')) {
                manage = label === 'literal_named_escape' ? 'const Manage=function Inner(){return <Max testId="settings.value"/>;};' : 'function Manage(){return <Max testId="settings.value"/>;}';
            }
            const value = label.startsWith('literal_') ? '"settings.value--region"' : 'testId+"--region"';
            fs.writeFileSync(path.join(root, 'source.tsx'), [
                'import React from "react"; declare const active:boolean; declare const dynamicKey:string; declare function Other(props:any):any; declare function renderInner(props:any):any;',
                `function Max({testId}:{testId:string}){return <section role="region" data-testid={${value}}/>;} function Min({testId}:{testId:string}){return <section role="region" data-testid={${label.startsWith('mixed_') ? '"settings.value--region"' : value}}/>;}`,
                manage,
                `function Item(${parameter}:{max:any;testId:string}){${body.replace(/^(PROPS|REST):/, '')}}`,
                `export function App(){${app}}`,
            ].join('\n'));
            const out = scanProject(loadConfig(config));
            assert.equal(out.diagnostics.some((d) => d.rule === 'duplicates'), duplicate, `${label}: ${JSON.stringify(out.diagnostics)}`);
        }
    });
});
