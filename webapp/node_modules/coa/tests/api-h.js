require('..').Cmd()
    .name('bla')
    .title('Bla bla bla')
    .helpful()
    .invoke({ help: true })
    .then(function(res) {
        console.log(res);
    })
    .done(); // Q.done()
