const { getFirestore, Timestamp } = require('firebase-admin/firestore')
const Joi = require('joi')
const { nanoid } = require('nanoid')
const { FirebaseError, CalendarError } = require('../errors')
const { calendarClient } = require('../helper')

const handler = {
    get: {
        auth: 'jwt_strategy',
        handler: async (request, h) => {
            const { userId } = request.auth.credentials
            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (typeof user.data().familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.data().familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const eventRef = familyRef.collection('events')
            const eventSnapshot = await eventRef.get()
            const events = []

            eventSnapshot.forEach((doc) => {
                const data = doc.data()
                data.start = data.start.toDate()
                data.end = data.end.toDate()

                events.push({
                    id: doc.id,
                    body: data
                })
            })

            const memberRef = familyRef.collection('members')
            const memberSnapshot = await memberRef.get()
            const members = []

            memberSnapshot.forEach((doc) => {
                members.push({
                    id: doc.id,
                    body: doc.data()
                })
            })

            for (const member of members) {
                const user = (await db.collection('users').doc(member.id).get()).data()
                user.birthday = user.birthday.toDate()
                user.age = new Date().getFullYear() - new Date(user.birthday).getFullYear()
                member.profile = user
            }

            for (const event of events) {
                const body = event.body
                const assignFor = members.find(member => member.id === body.assignFor)
                body.assignFor = {
                    id: assignFor.id,
                    name: assignFor.body.name
                }

                const creator = members.find(member => member.id === body.creator)
                body.creator = {
                    id: creator.id,
                    name: creator.body.name
                }
            }

            return h.response({
                statusCode: 200,
                status: 'success',
                message: 'Berhasil mengambil data event.',
                data: {
                    id: family.id,
                    body: family.data(),
                    members,
                    events
                }
            })
        }
    },
    insert: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        validate: {
            payload: Joi.object({
                start: Joi.date().iso().less(Joi.ref('end')).required(),
                end: Joi.date().iso().required(),
                summary: Joi.string().required(),
                description: Joi.string().required(),
                userId: Joi.string().required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const payload = request.payload
            const { userId } = request.auth.credentials
            const start = new Date(payload.start)
            const end = new Date(payload.end)

            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (typeof user.data().familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.data().familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const queryOne = await familyRef.collection('events')
                .orderBy('start').startAt(start).endAt(new Date(end.getTime() - 1000)).get()

            const queryTwo = await familyRef.collection('events')
                .orderBy('end').startAt(new Date(start.getTime() + 1000)).endAt(end).get()

            let busy = false
            if (!queryOne.empty) {
                queryOne.forEach((doc) => {
                    busy = doc.data().assignFor === payload.userId
                })
            } else if (!queryTwo.empty) {
                queryTwo.forEach((doc) => {
                    busy = doc.data().assignFor === payload.userId
                })
            }

            if (busy) {
                return h.response({
                    statusCode: 400,
                    status: 'fail',
                    message: 'Sudah ada jadwal.'
                }).code(400)
            }

            try {
                const responsible = (await familyRef.collection('members').doc(payload.userId).get()).data()

                const calendarRes = await calendar.events.insert({
                    calendarId: family.data().calendarId,
                    requestBody: {
                        start: {
                            dateTime: start.toISOString()
                        },
                        end: {
                            dateTime: end.toISOString()
                        },
                        summary: payload.summary,
                        description: `<strong>${responsible.name}</strong><p>${payload.description}</p>`
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan event.')
                })

                console.log(calendarRes.data)

                const id = nanoid(16)
                const data = {
                    creator: userId,
                    start: Timestamp.fromDate(start),
                    end: Timestamp.fromDate(end),
                    summary: payload.summary,
                    description: payload.description,
                    assignFor: payload.userId,
                    eventId: calendarRes.data.id
                }

                const eventRef = familyRef.collection('events').doc(id)
                await eventRef.set(data).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal menambahkan event.')
                })

                return h.response({
                    statusCode: 201,
                    status: 'success',
                    message: 'Berhasil menambahkan event.',
                    data: {
                        id,
                        body: data
                    }
                }).code(201)
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
                    }).code(500)
                } else if (error instanceof CalendarError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Google Calendar Error: ${error.message}`
                    }).code(500)
                } else {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: error.message
                    }).code(500)
                }
            }
        }
    },
    update: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        validate: {
            payload: Joi.object({
                start: Joi.date().iso().less(Joi.ref('end')).required(),
                end: Joi.date().iso().required(),
                summary: Joi.string().required(),
                description: Joi.string().required(),
                userId: Joi.string().required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const payload = request.payload
            const { userId } = request.auth.credentials
            const { id } = request.params
            const start = new Date(payload.start)
            const end = new Date(payload.end)

            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (typeof user.data().familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.data().familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const eventRef = familyRef.collection('events').doc(id)
            const events = await eventRef.get()

            if (!events.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Event tidak ditemukan.'
                }).code(404)
            }

            const queryOne = await familyRef.collection('events')
                .orderBy('start').startAt(start).endAt(new Date(end.getTime() - 1000)).get()

            const queryTwo = await familyRef.collection('events')
                .orderBy('end').startAt(new Date(start.getTime() + 1000)).endAt(end).get()

            let busy = false
            if (!queryOne.empty) {
                queryOne.forEach((doc) => {
                    busy = doc.data().assignFor === payload.userId
                })
            }

            if (!queryTwo.empty) {
                queryTwo.forEach((doc) => {
                    busy = doc.data().assignFor === payload.userId
                })
            }

            if (busy) {
                return h.response({
                    statusCode: 400,
                    status: 'fail',
                    message: 'Sudah ada jadwal.'
                }).code(400)
            }

            try {
                const responsible = (await familyRef.collection('members').doc(payload.userId).get()).data()

                const calendarRes = await calendar.events.update({
                    calendarId: family.data().calendarId,
                    eventId: events.data().eventId,
                    requestBody: {
                        start: {
                            dateTime: start.toISOString()
                        },
                        end: {
                            dateTime: end.toISOString()
                        },
                        summary: payload.summary,
                        description: `<strong>${responsible.name}</strong><p>${payload.description}</p>`
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal mengubah event.')
                })

                const data = {
                    creator: userId,
                    start: Timestamp.fromDate(start),
                    end: Timestamp.fromDate(end),
                    summary: payload.summary,
                    description: payload.description,
                    assignFor: payload.userId,
                    eventId: calendarRes.data.id
                }

                const eventRef = familyRef.collection('events').doc(id)
                await eventRef.update(data).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal mengubah event.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Berhasil mengubah event.',
                    data: {
                        id,
                        body: data
                    }
                }).code(200)
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
                    }).code(500)
                } else if (error instanceof CalendarError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Google Calendar Error: ${error.message}`
                    }).code(500)
                } else {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: error.message
                    }).code(500)
                }
            }
        }
    },
    delete: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const { id } = request.params
            const { userId } = request.auth.credentials
            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = (await userRef.get()).data()

            if (typeof user.familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const eventRef = familyRef.collection('events').doc(id)
            const event = await eventRef.get()

            if (!event.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data event tidak ditemukan.'
                }).code(404)
            }

            const memberRef = familyRef.collection('members').doc(userId)
            const member = await memberRef.get()

            const isCreator = event.data().creator === userId
            if (!isCreator) {
                const isOwner = member.data().role === 'owner'
                if (!isOwner) {
                    return h.response({
                        statusCode: 403,
                        status: 'fail',
                        message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                    }).code(403)
                }
            }

            try {
                await calendar.events.delete({
                    calendarId: family.data().calendarId,
                    eventId: event.data().eventId
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menghapus event.')
                })

                await eventRef.delete().catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal menghapus event.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Data event berhasil dihapus.'
                }).code(200)
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
                    }).code(500)
                } else if (error instanceof CalendarError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Google Calendar Error: ${error.message}`
                    }).code(500)
                } else {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: error.message
                    }).code(500)
                }
            }
        }
    },
    done: {
        auth: 'jwt_strategy',
        pre: [
            { method: calendarClient, assign: 'calendar' }
        ],
        handler: async (request, h) => {
            const calendar = request.pre.calendar
            const { userId } = request.auth.credentials
            const { id } = request.params
            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (typeof user.data().familyId === 'undefined') {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak memiliki data keluarga.'
                }).code(404)
            }

            const familyRef = db.collection('families').doc(user.data().familyId)
            const family = await familyRef.get()

            if (!family.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Data keluarga tidak ditemukan.'
                }).code(404)
            }

            const eventRef = familyRef.collection('events').doc(id)
            const event = await eventRef.get()

            if (!event.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'Event tidak ditemukan.'
                }).code(404)
            }

            if (event.data().done) {
                return h.response({
                    statusCode: 400,
                    status: 'fail',
                    message: 'Event sudah selesai.'
                }).code(400)
            }

            const assignFor = event.data().assignFor
            if (assignFor !== userId) {
                return h.response({
                    statusCode: 403,
                    status: 'fail',
                    message: 'Event ini tidak ditugaskan kepada Anda.'
                }).code(403)
            }

            console.log(assignFor)

            try {
                await calendar.events.delete({
                    calendarId: family.data().calendarId,
                    eventId: event.data().eventId
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menghapus event.')
                })

                const eventRef = familyRef.collection('events').doc(id)
                await eventRef.update({ done: true }).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal mengubah event.')
                })

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Event sudah diselesaikan.',
                    data: {
                        id: event.id,
                        body: event.data()
                    }
                }).code(200)
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
                    }).code(500)
                } else if (error instanceof CalendarError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Google Calendar Error: ${error.message}`
                    }).code(500)
                } else {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: error.message
                    }).code(500)
                }
            }
        }
    }
}

module.exports = handler
