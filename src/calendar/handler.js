const { google } = require('googleapis')
const key = require('./../../key.json')

const oauth2Client = new google.auth.OAuth2(
    key.web.client_id,
    key.web.client_secret,
    key.web.redirect_uris[0]
)

const handler = {
    calendar: {
        auth: 'session',
        handler: async (request, h) => {
            oauth2Client.setCredentials({
                access_token: request.auth.credentials.token,
                refresh_token: request.auth.credentials.refresh_token
            })

            const calendar = google.calendar({
                version: 'v3',
                auth: oauth2Client
            })

            const res = await calendar.calendars.get({
                calendarId: 'primary'
            })

            return h.response({
                status: 'success',
                message: 'Berhasil mengambil data calendar.',
                items: res.data
            })
        }
    },
    events: {
        auth: 'session',
        handler: async (request, h) => {
            oauth2Client.setCredentials({
                access_token: request.auth.credentials.token,
                refresh_token: request.auth.credentials.refresh_token
            })

            const calendar = google.calendar({
                version: 'v3',
                auth: oauth2Client
            })

            const res = await calendar.events.list({
                calendarId: 'primary',
                timeMin: (new Date()).toISOString(),
                maxResults: 5
            })

            return h.response({
                status: 'success',
                message: 'Berhasil mengambil data events.',
                data: res.data
            })
        }
    }
}

module.exports = handler
