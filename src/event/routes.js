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
},
{
    method: 'DELETE',
    path: '/event/{id}',
    options: handler.delete
}]

module.exports = routes
