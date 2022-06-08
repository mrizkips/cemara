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
    method: 'PUT',
    path: '/event/{id}',
    options: handler.update
},
{
    method: 'DELETE',
    path: '/event/{id}',
    options: handler.delete
},
{
    method: 'PUT',
    path: '/event/{id}/done',
    options: handler.done
}]

module.exports = routes
