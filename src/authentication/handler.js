const handler = {
    google: {
        auth: {
            mode: 'try',
            strategy: 'google'
        },
        handler: async function (request, h) {
            if (request.auth.isAuthenticated) {
                const credentials = request.auth.credentials
                request.cookieAuth.set(credentials)

                const response = h.response({
                    status: 'success',
                    message: 'Otentikasi berhasil menggunakan akun google.',
                    credentials
                }).code(200)
                return response
            }

            const response = h.response({
                status: 'fail',
                message: 'Otentikasi gagal. Silakan coba lagi.'
            }).code(400)
            return response
        }
    },
    logout: {
        auth: 'session',
        handler: async (request, h) => {
            request.cookieAuth.clear()

            const response = h.response({
                status: 'success',
                message: 'Berhasil logout'
            }).code(200)
            return response
        }
    }
}

module.exports = handler
