const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/calendar',
    options: handler.calendar
}, {
    method: 'GET',
    path: '/calendar/events',
    options: handler.events
}]

module.exports = routes
