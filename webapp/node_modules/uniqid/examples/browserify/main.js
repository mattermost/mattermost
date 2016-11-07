var uniqid = require('../../');
window.onload = function(){
    var ul = document.getElementsByTagName('ul')[0]
    for(var i = 0; i < 1000; i++){
        var li = document.createElement('li')
        li.innerHTML = uniqid()
        ul.appendChild(li)
    }
}