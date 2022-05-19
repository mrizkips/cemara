const { google } = require('googleapis')
const key = require('./../../key.json')

const setCalendar = (token) => {
    const oauth2Client = new google.auth.OAuth2(
        key.web.client_id,
        key.web.client_secret,
        key.web.redirect_uris[0]
    )

    oauth2Client.setCredentials({
        access_token: token
    })

    const calendar = google.calendar({
        version: 'v3',
        auth: oauth2Client
    })

    return calendar
}

const handler = {
    calendar: {
        get: {
            handler: async (request, h, err) => {
                const token = request.query.token
                const calendar = setCalendar(token)

                const res = await calendar.calendars.get({
                    calendarId: request.params.id ?? 'primary'
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil mengambil data calendar.',
                    items: res.data
                })
            }
        },
        insert: {
            auth: 'session',
            handler: async (request, h, err) => {
                const calendar = setCalendar(request.auth.credentials)
                const payload = request.payload

                const res = calendar.calendars.insert({
                    summary: payload.summary
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil menambahkan calendar.',
                    items: res.data
                })
            }
        }
    },
    event: {
        list: {
            auth: 'session',
            handler: async (request, h, err) => {
                const calendar = setCalendar(request.auth.credentials)

                const res = await calendar.events.list({
                    calendarId: request.params.id ?? 'primary',
                    timeMin: (new Date()).toISOString(),
                    maxResults: 5
                })

                if (err) {
                    throw new Error(err)
                }

                return h.response({
                    status: 'success',
                    message: 'Berhasil mengambil data events.',
                    data: res.data
                })
            }
        }
    }
}

module.exports = handler
