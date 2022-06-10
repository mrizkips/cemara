const { getFirestore } = require('firebase-admin/firestore')
const Joi = require('joi')
const { FirebaseError } = require('../errors')

const interestsList = [
    'Makanan',
    'Olahraga',
    'Alam',
    'Hiburan',
    'Teknologi',
    'Edukasi',
    'Keuangan',
    'Binatang'
]
const skillsList = [
    'Masak',
    'Sosialisasi',
    'Swakarya/DIY',
    'Otomotif',
    'Manajemen',
    'Berkebun',
    'Kelistrikan'
]

const handler = {
    get: {
        auth: 'jwt_strategy',
        handler: async (request, h) => {
            const { userId } = request.auth.credentials
            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (!user.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak ditemukan.'
                }).code(404)
            }

            const data = user.data()
            if (typeof data.birthday !== 'undefined') {
                data.birthday = data.birthday.toDate()
                data.age = new Date().getFullYear() - new Date(data.birthday).getFullYear()
            }

            return h.response({
                statusCode: 200,
                status: 'success',
                message: 'Berhasil mengambil data event.',
                data: {
                    id: user.id,
                    body: data,
                    interestsList,
                    skillsList
                }
            })
        }
    },
    update: {
        auth: 'jwt_strategy',
        validate: {
            payload: Joi.object({
                name: Joi.string().required(),
                birthday: Joi.date().required(),
                role: Joi.string().valid('Ayah', 'Ibu', 'Anak').required(),
                interests: Joi.array().items(Joi.string().valid(...interestsList)).length(3).required(),
                skills: Joi.array().items(Joi.string().valid(...skillsList)).length(2).required()
            }),
            failAction: (request, h, error) => {
                return error.isJoi ? h.response(error.output).takeover() : h.response(error).takeover()
            }
        },
        handler: async (request, h) => {
            const { userId } = request.auth.credentials
            const payload = request.payload
            const db = getFirestore()

            const userRef = db.collection('users').doc(userId)
            const user = await userRef.get()

            if (!user.exists) {
                return h.response({
                    statusCode: 404,
                    status: 'fail',
                    message: 'User tidak ditemukan.'
                }).code(404)
            }

            try {
                await userRef.update(payload).catch((error) => {
                    console.log(error)
                    throw new FirebaseError('gagal mengubah profil.')
                })

                if (typeof user.data().familyId !== 'undefined') {
                    const memberRef = db.collection('families').doc(user.data().familyId).collection('members').doc(userId)
                    const member = await memberRef.get()

                    if (member.exists) {
                        await memberRef.update({
                            name: payload.name
                        }).catch((error) => {
                            console.log(error)
                            throw new FirebaseError('gagal mengubah profil.')
                        })
                    }
                }

                return h.response({
                    statusCode: 200,
                    status: 'success',
                    message: 'Berhasil mengubah profil.',
                    data: payload
                })
            } catch (error) {
                if (error instanceof FirebaseError) {
                    return h.response({
                        statusCode: 500,
                        status: 'fail',
                        message: `Firebase Error: ${error.message}`
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
