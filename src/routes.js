const routes = [{
    method: 'GET',
    path: '/',
    options: {
        auth: false,
        handler: (request, h) => {
            return 'Halo, aku Cemara API v1.0.0'
        }
    }
}, {
    method: '*',
    path: '/{any*}',
    options: {
        auth: false,
        handler: (request, h) => {
            return h.response({
                status: 'fail',
                message: 'API tidak ditemukan'
            }).code(404)
        }
    }
}]

module.exports = routes
