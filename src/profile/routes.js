const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/profile',
    options: handler.get
},
{
    method: 'PUT',
    path: '/profile',
    options: handler.update
}]

module.exports = routes
