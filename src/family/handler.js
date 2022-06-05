const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { nanoid } = require('nanoid')
const { FirebaseError, CalendarError } = require('../errors')
const { calendarClient, generateToken } = require('./../helper')
const Joi = require('joi')

const handler = {
    family: {
        insert: {
            auth: 'session',
            pre: [
                { method: calendarClient, assign: 'calendar' }
            ],
            validate: {
                payload: Joi.object({
                    name: Joi.string().required()
                }),
                failAction: (request, h, error) => {
                    return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
                }
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const { name } = request.payload
                const { userId } = request.auth.credentials

                const db = getFirestore()
                const userRef = db.collection('users').doc(userId)
                const user = (await userRef.get()).data()

                if (user.familyId) {
                    return h.response({
                        statusCode: 400,
                        status: 'fail',
                        message: 'User sudah memiliki keluarga.'
                    }).code(400)
                }

                const calendarRes = await calendar.calendars.insert({
                    requestBody: {
                        summary: name,
                        description: 'Dibuat menggunakan Cemara.'
                    }
                }).catch((error) => {
                    console.log(error)
                    throw new CalendarError('gagal menambahkan data.')
                })

                const id = nanoid(16)
                const familyRef = db.collection('families').doc(id)
                const memberRef = familyRef.collection('members').doc(userId)

                try {
                    await db.runTransaction(async (t) => {
                        t.set(familyRef, {
                            name,
                            calendarId: calendarRes.data.id,
                            token: generateToken(8)
                        })

                        t.set(memberRef, {
                            role: 'owner'
                        })

                        t.update(userRef, {
                            familyId: familyRef.id
                        })
                    })

                    await calendar.acl.insert({
                        calendarId: calendarRes.data.id,
                        requestBody: {
                            role: 'freeBusyReader',
                            scope: {
                                type: 'user',
                                value: user.email
                            }
                        }
                    }).catch((error) => {
                        console.log(error)
                        throw new CalendarError('gagal menambahkan role ke calendar.')
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

                const memberRef = familyRef.collection('members')
                const snapshot = await memberRef.get()
                const members = []

                snapshot.forEach((doc) => {
                    members.push({
                        id: doc.id,
                        role: doc.data().role
                    })
                })

                const data = family.data()
                data.id = family.id
                data.members = members

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Data keluarga ditemukan.',
                    data
                })
            }
        },
        update: {
            auth: 'session',
            pre: [
                { method: calendarClient, assign: 'calendar' }
            ],
            validate: {
                payload: Joi.object({
                    name: Joi.string().required()
                }),
                failAction: (request, h, error) => {
                    return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
                }
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const { name } = request.payload
                const { userId } = request.auth.credentials
                const { id } = request.params
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

                const memberRef = familyRef.collection('members').doc(userId)
                const member = await memberRef.get()

                if (!member.exists || member.data().role !== 'owner') {
                    return h.response({
                        statusCode: 403,
                        status: 'fail',
                        message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                    }).code(403)
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
        delete: {
            auth: 'session',
            pre: [
                { method: calendarClient, assign: 'calendar' }
            ],
            validate: {
                params: Joi.object({
                    id: Joi.string().required()
                })
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const { id } = request.params
                const { userId } = request.auth.credentials
                const db = getFirestore()

                const familyRef = db.collection('families').doc(id)
                const family = await familyRef.get()

                const userRef = db.collection('users').doc(userId)

                if (!family.exists) {
                    return h.response({
                        statusCode: 404,
                        status: 'fail',
                        message: 'Data keluarga tidak ditemukan.'
                    }).code(404)
                }

                const memberRef = familyRef.collection('members')
                const member = await memberRef.doc(userId).get()

                if (!member.exists || member.data().role !== 'owner') {
                    return h.response({
                        statusCode: 403,
                        status: 'fail',
                        message: 'Tidak memiliki otoritas untuk melakukan aksi ini.'
                    }).code(403)
                }

                try {
                    await calendar.calendars.delete({
                        calendarId: family.data().calendarId
                    }).catch((error) => {
                        console.log(error)
                        throw new CalendarError('gagal menghapus data.')
                    })

                    const members = []
                    const snapshot = await memberRef.get()
                    snapshot.docs.forEach((doc) => {
                        members.push(doc.ref)
                    })

                    await db.runTransaction(async (t) => {
                        t.delete(familyRef)
                        t.update(userRef, {
                            familyId: FieldValue.delete()
                        })
                        members.forEach((ref) => {
                            t.delete(ref)
                        })
                    }).catch((error) => {
                        console.log(error)
                        throw new FirebaseError('gagal menghapus data keluarga.')
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
        },
        token: {
            auth: 'session',
            pre: [
                { method: calendarClient, assign: 'calendar' }
            ],
            validate: {
                payload: Joi.object({
                    token: Joi.string().min(8).max(8).required()
                }),
                failAction: (request, h, error) => {
                    return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
                }
            },
            handler: async (request, h) => {
                const calendar = request.pre.calendar
                const { userId } = request.auth.credentials
                const { token } = request.payload
                const db = getFirestore()

                const familyRef = db.collection('families')
                const snapshot = await familyRef.where('token', '==', token).get()

                if (snapshot.empty) {
                    return h.response({
                        statusCode: 404,
                        status: 'fail',
                        message: 'Token tidak ditemukan.'
                    }).code(404)
                }

                const userRef = db.collection('users').doc(userId)
                const user = (await userRef.get()).data()

                if (typeof user.familyId !== 'undefined') {
                    return h.response({
                        statusCode: 400,
                        status: 'fail',
                        message: 'User sudah bergabung ke dalam keluarga.'
                    }).code(400)
                }

                try {
                    snapshot.forEach(async (family) => {
                        const memberRef = family.ref.collection('members').doc(userId)
                        await memberRef.set({
                            role: 'editor'
                        })

                        await userRef.update({
                            familyId: family.id
                        }).catch((error) => {
                            console.log(error)
                            throw new FirebaseError('gagal menambahkan familyId.')
                        })

                        await calendar.acl.insert({
                            calendarId: family.calendarId,
                            requestBody: {
                                role: 'freeBusyReader',
                                scope: {
                                    type: 'user',
                                    value: user.email
                                }
                            }
                        })
                    })

                    return h.response({
                        statusCode: 200,
                        status: 'success',
                        message: 'User berhasil ditambahkan ke dalam keluarga.'
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
}

module.exports = handler
