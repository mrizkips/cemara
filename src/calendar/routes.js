const handler = require('./handler')

const routes = [{
    method: 'GET',
    path: '/calendar/{id?}',
    options: handler.calendar.get
},
{
    method: 'POST',
    path: '/calendar',
    options: handler.calendar.insert
},
{
    method: 'GET',
    path: '/calendar/event/{id?}',
    options: handler.event.list
}]

module.exports = routes
