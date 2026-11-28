import React from 'react';

type Node = {id: string; children?: Node[]};

// renders itself for each child, handing its own scope back in (like the blocks ContainerBlock renders)
export function Branch({node, testIdScope}: {node: Node; testIdScope: string}) {
    return (
        <div>
            <button data-testid={`${testIdScope}.action:${node.id}--button`}/>
            {node.children?.map((child) => (
                <Branch
                    key={child.id}
                    node={child}
                    testIdScope={testIdScope}
                />
            ))}
        </div>
    );
}

export function TreeHost({tree}: {tree: Node}) {
    return (
        <div>
            <Branch
                node={tree}
                testIdScope='values.tree'
            />
        </div>
    );
}

// a post renders a preview of another post, which renders a post again (a quoted message inside a report): the inner
// post's scope is built from the outer one's, so one level unrolls to a concrete template
export function Message({testIdScope, quoted}: {testIdScope: string; quoted?: boolean}) {
    return (
        <div>
            <span data-testid={`${testIdScope}.text--text`}/>
            {quoted && <Quote testIdScope={`${testIdScope}.quote`}/>}
        </div>
    );
}

function Quote({testIdScope}: {testIdScope: string}) {
    return <Message testIdScope={`${testIdScope}.post`}/>;
}

export function MessageHost() {
    return (
        <Message
            testIdScope='values.message'
            quoted={true}
        />
    );
}
