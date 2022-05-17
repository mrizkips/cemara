const { google } = require('googleapis')

const handler = {
    calendar: {
        auth: 'session',
        handler: async (request, h) => {
            const calendar = google.calendar({
                version: 'v3',
                headers: {
                    Authorization: `Bearer ${request.auth.credentials.token}`
                }
            })

            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: (new Date()).toISOString(),
                maxResults: 5
            })

            return h.response({
                status: 'success',
                message: 'Otentikasi calendar berhasil',
                items: res.data.items
            })
        }
    }
}

module.exports = handler
