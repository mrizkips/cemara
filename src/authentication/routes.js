const handler = require('./handler')

const routes = [{
    method: 'POST',
    path: '/auth/login',
    options: handler.login
},
{
    method: 'GET',
    path: '/auth/google',
    options: handler.google
}]

module.exports = routes
