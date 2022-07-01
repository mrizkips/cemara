const handler = require('./handler')

const routes = [{
    method: 'POST',
    path: '/predict',
    options: handler.post
}]

module.exports = routes
