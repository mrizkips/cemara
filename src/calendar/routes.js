const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/calendar',
    options: handler.calendar
}, {
    method: 'GET',
    path: '/calendar/events',
    handler: (request, h) => {
        return 'test'
    }
}]

module.exports = routes
