const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/calendar',
    options: handler.calendar
}]

module.exports = routes
