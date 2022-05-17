const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/auth/google',
    options: handler.google
}, {
    method: 'GET',
    path: '/auth/logout',
    options: handler.logout
}]

module.exports = routes
