const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/event',
    options: handler.get
},
{
    method: 'POST',
    path: '/event',
    options: handler.insert
}]

module.exports = routes
