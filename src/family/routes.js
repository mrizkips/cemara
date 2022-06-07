const handler = require('./handler')

const routes = [{
    method: 'POST',
    path: '/family',
    options: handler.insert
},
{
    method: 'PUT',
    path: '/family/{id}',
    options: handler.update
},
{
    method: 'GET',
    path: '/family',
    options: handler.get
},
{
    method: 'POST',
    path: '/family/join',
    options: handler.join
},
{
    method: 'DELETE',
    path: '/family/{id}/leave',
    options: handler.leave
},
{
    method: 'PUT',
    path: '/family/{id}/role',
    options: handler.role
},
{
    method: 'DELETE',
    path: '/family/{id}',
    options: handler.delete
}]

module.exports = routes
