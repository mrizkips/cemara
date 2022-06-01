const handler = require('./handler')

const routes = [{
    method: 'POST',
    path: '/family',
    options: handler.family.insert
},
{
    method: 'PUT',
    path: '/family/{id}',
    options: handler.family.update
},
{
    method: 'GET',
    path: '/family',
    options: handler.family.get
},
// {
//     method: 'POST',
//     path: '/family/token',
//     options: handler.family.token
// },
{
    method: 'DELETE',
    path: '/family/{id}',
    options: handler.family.delete
}]

module.exports = routes
