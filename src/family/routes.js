const handler = require('./handler')

const routes = [{
    method: 'POST',
    path: '/family',
    options: handler.family.insert
},
{
    method: 'DELETE',
    path: '/family',
    options: handler.family.delete
}]

module.exports = routes
