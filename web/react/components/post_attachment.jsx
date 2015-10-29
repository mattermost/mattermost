export default class PostAttachment extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <div>
                {'Pre text'}
                <div style={{border: '1px solid #CCC', borderRadius: 4, padding: '2px 5px', margin: '5px 0'}}>
                    <div
                        style={{borderLeft: '4px solid #F35A00', padding: '2px 0 2px 10px'}}
                    >
                        <strong>
                            <img
                                className='post-profile-img'
                                src='http://cdn.sr-vice.de/images/misc/jenkins.png'
                                height='14'
                                width='14'
                                style={{borderRadius: 50, marginRight: 5}}
                            />
                                {'@testuser'}
                            </strong>
                        <h1 style={{margin: '5px 0', padding: 0, lineHeight: '16px', fontSize: 16}}>
                            <a
                                href='#'
                                style={{fontSize: 16}}
                            >
                                {'Attachment title'}
                            </a>
                        </h1>
                        <div>
                            <div style={{float: 'left', width: 485, paddingRight: 5}}>
                                <p>
                                    {'This is the main text in a message attachment, and can contain standard message markup (see details below).'}
                                </p>
                                <img
                                    src='https://api.slack.com/img/api/attachment_image.png'
                                    style={{maxWidth: '100%', display: 'none'}}
                                />
                                <table style={{width: '100%'}}>
                                    <thead>
                                    <tr>
                                        <th>{'Assigned to'}</th>
                                        <th>{'Priority'}</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    <tr>
                                        <td>{'Paul'}</td>
                                        <td>{'Critical'}</td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div style={{width: 75, float: 'right'}}>
                                <img
                                    src='http://www.paulirish.com/wp-content/uploads/2009/02/f811e8ead5d62dfa20b55803cd7908b0.png'
                                    style={{height: 75}}
                                />
                            </div>
                            <div style={{clear: 'both'}}></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}