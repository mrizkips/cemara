const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { nanoid } = require('nanoid')
const { FirebaseError, CalendarError } = require('../errors')
const { initCalendarApi, generateToken } = require('./../helper')
const Joi = require('joi')

const handler = {
    family: {
        insert: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                payload: Joi.object({
                    name: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const name = request.payload.name
                const userId = request.auth.credentials.userId

                const calendarRes = await calendar.calendars.insert({
                    requestBody: {
                        summary: name,
                        description: 'Dibuat menggunakan Cemara.'
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan data.')
                })

                const familyToken = generateToken(8)
                const db = getFirestore()
                const id = nanoid(16)

                const familyRef = db.collection('families').doc(id)
                const userRef = db.collection('users').doc(userId)

                try {
                    await db.runTransaction(async (t) => {
                        t.set(familyRef, {
                            name,
                            calendarId: calendarRes.data.id,
                            token: familyToken
                        })

                        t.update(userRef, {
                            familyId: familyRef.id
                        })
                    })

                    return h.response({
                        statusCode: 201,
                        status: 'success',
                        message: 'Berhasil menambahkan keluarga.',
                        data: {
                            familyId: familyRef.id
                        }
                    }).code(201)
                } catch (error) {
                    await calendar.calendars.delete({
                        calendarId: calendarRes.data.id
                    })

                    if (error instanceof CalendarError) {
                        return h.response({
                            statusCode: '500',
                            status: 'fail',
                            message: `Google Calendar Error: ${error.message}`
                        }).code(500)
                    } else {
                        return h.response({
                            statusCode: '500',
                            status: 'fail',
                            message: error.message
                        }).code(500)
                    }
                }
            }
        },
        update: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                payload: Joi.object({
                    name: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const name = request.payload.name
                const id = request.params.id
                const db = getFirestore()

                const familyRef = db.collection('families').doc(id)
                const family = await familyRef.get()

                if (!family.exists) {
                    return h.response({
                        statusCode: 404,
                        status: 'fail',
                        message: 'Data keluarga tidak ditemukan.'
                    }).code(404)
                }

                try {
                    await familyRef.update({ name }).catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal memperbaharui data keluarga.')
                    })

                    await calendar.calendars.update({
                        calendarId: family.data().calendarId,
                        requestBody: {
                            summary: name
                        }
                    }).catch((error) => {
                        console.log(error)
                        throw new CalendarError('gagal memperbaharui data.')
                    })

                    return h.response({
                        statusCode: 200,
                        status: 'success',
                        message: 'Data keluarga berhasil diperbaharui.',
                        data: {
                            familyId: familyRef.id,
                            name
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
        get: {
            auth: 'session',
            handler: async (request, h) => {
                const userId = request.auth.credentials.userId
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

                const data = family.data()
                data.id = family.id

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Data keluarga ditemukan.',
                    data
                })
            }
        },
        delete: {
            auth: 'session',
            pre: [
                { method: initCalendarApi, assign: 'calendar' }
            ],
            validate: {
                params: Joi.object({
                    id: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const id = request.params.id
                const userId = request.auth.credentials.userId
                const db = getFirestore()

                const familyRef = db.collection('families').doc(id)
                const family = await familyRef.get()

                const userRef = db.collection('users').doc(userId)
                const user = await userRef.get()

                if (user.data().familyId !== id) {
                    return h.response({
                        statusCode: 403,
                        status: 'fail',
                        message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                    }).code(403)
                }

                if (!family.exists) {
                    return h.response({
                        statusCode: 404,
                        status: 'fail',
                        message: 'Data keluarga tidak ditemukan.'
                    }).code(404)
                }

                try {
                    await calendar.calendars.delete({
                        calendarId: family.data().calendarId
                    }).catch((error) => {
                        console.log(error)
                        throw new CalendarError('gagal menghapus data.')
                    })

                    await familyRef.delete().catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal menghapus data keluarga.')
                    })

                    await userRef.update({
                        familyId: FieldValue.delete()
                    }).catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal menghapus isian familyId di dokumen users.')
                    })

                    return h.response({
                        status: 'success',
                        message: 'Data keluarga berhasil dihapus!'
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
        // token: {
        //     auth: 'session',
        //     pre: [
        //         { method: initCalendarApi, assign: 'calendar' }
        //     ],
        //     validate: {
        //         payload: Joi.object({
        //             token: Joi.string().min(8).max(8).required()
        //         }),
        //         failAction: (request, h, error) => {
        //             return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
        //         }
        //     },
        //     handler: async (request, h) => {
        //         const calendar = request.pre.calendar
        //         const { userId } = request.auth.credentials
        //         const { token } = request.payload
        //         const db = getFirestore()

        //         const familyRef = db.collection('families')
        //         const snapshot = await familyRef.where('token', '==', token).get()

        //         if (snapshot.empty) {
        //             return h.response({
        //                 statusCode: 404,
        //                 status: 'fail',
        //                 message: 'Token tidak ditemukan.'
        //             }).code(404)
        //         }

        //         const userRef = db.collection('users').doc(userId)

        //         try {
        //             snapshot.forEach(family => {
        //                 userRef.update({
        //                     familyId: family.id
        //                 }).catch((error) => {
        //                     console.log(error)
        //                     throw new FirebaseError('gagal menambahkan familyId.')
        //                 })

        //                 calendar.acl.insert({
        //                     calendarId: family.calendarId,
        //                     sendNotifications: false,
        //                     requestBody: {

        //                     }
        //                 })
        //             })
        //         } catch (error) {
        //             if (error instanceof FirebaseError) {
        //                 return h.response({
        //                     statusCode: 500,
        //                     status: 'fail',
        //                     message: `Firebase Error: ${error.message}`
        //                 }).code(500)
        //             } else if (error instanceof CalendarError) {
        //                 return h.response({
        //                     statusCode: 500,
        //                     status: 'fail',
        //                     message: `Google Calendar Error: ${error.message}`
        //                 }).code(500)
        //             } else {
        //                 return h.response({
        //                     statusCode: 500,
        //                     status: 'fail',
        //                     message: error.message
        //                 }).code(500)
        //             }
        //         }
        //     }
        // }
    }
}

module.exports = handler
