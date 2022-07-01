const tf = require('@tensorflow/tfjs')
const tfn = require('@tensorflow/tfjs-node')
const path = require('path')

const prepareData = (payload) => {
    const val = []
    payload.role === 'Anak' ? val.push(1) : val.push(0)
    payload.role === 'Ayah' ? val.push(1) : val.push(0)
    payload.role === 'Ibu' ? val.push(1) : val.push(0)
    payload.age >= 15 || payload.age <= 20 ? val.push(1) : val.push(0)
    payload.age < 15 ? val.push(1) : val.push(0)
    payload.age >= 21 || payload.age <= 55 ? val.push(1) : val.push(0)
    payload.age > 55 ? val.push(1) : val.push(0)
    payload.interests.forEach(element => {
        let count = 0
        if (count === 0) {
            element === 'Alam' ? val.push(1) : val.push(0)
            element === 'Binatang' ? val.push(1) : val.push(0)
            element === 'Edukasi' ? val.push(1) : val.push(0)
            element === 'Hiburan' ? val.push(1) : val.push(0)
            element === 'Keuangan' ? val.push(1) : val.push(0)
            element === 'Makanan' ? val.push(1) : val.push(0)
            element === 'Olahraga' ? val.push(1) : val.push(0)
            element === 'Teknologi' ? val.push(1) : val.push(0)
        } else if (count === 1) {
            element === 'Alam' ? val.push(1) : val.push(0)
            element === 'Animasi' ? val.push(1) : val.push(0)
            element === 'Binatang' ? val.push(1) : val.push(0)
            element === 'Edukasi' ? val.push(1) : val.push(0)
            element === 'Hiburan' ? val.push(1) : val.push(0)
            element === 'Keuangan' ? val.push(1) : val.push(0)
            element === 'Literatur' ? val.push(1) : val.push(0)
            element === 'Olahraga' ? val.push(1) : val.push(0)
            element === 'Teknologi' ? val.push(1) : val.push(0)
        } else {
            element === 'Alam' ? val.push(1) : val.push(0)
            element === 'Animasi' ? val.push(1) : val.push(0)
            element === 'Binatang' ? val.push(1) : val.push(0)
            element === 'Edukasi' ? val.push(1) : val.push(0)
            element === 'Hiburan' ? val.push(1) : val.push(0)
            element === 'Keuangan' ? val.push(1) : val.push(0)
            element === 'Kesehatan' ? val.push(1) : val.push(0)
            element === 'Literatur' ? val.push(1) : val.push(0)
            element === 'Teknologi' ? val.push(1) : val.push(0)
        }
        count++
    })
    payload.skills.forEach(element => {
        let count = 0
        if (count === 0) {
            element === 'Berkebun' ? val.push(1) : val.push(0)
            element === 'Kelistrikan' ? val.push(1) : val.push(0)
            element === 'Manajemen' ? val.push(1) : val.push(0)
            element === 'Masak' ? val.push(1) : val.push(0)
            element === 'Otomotif' ? val.push(1) : val.push(0)
            element === 'Sosialisasi' ? val.push(1) : val.push(0)
            element === 'Swakarya/DIY' ? val.push(1) : val.push(0)
        } else {
            element === 'Berkebun' ? val.push(1) : val.push(0)
            element === 'Kelistrikan' ? val.push(1) : val.push(0)
            element === 'Manajemen' ? val.push(1) : val.push(0)
            element === 'Otomotif' ? val.push(1) : val.push(0)
            element === 'Sosialisasi' ? val.push(1) : val.push(0)
            element === 'Swakarya/DIY' ? val.push(1) : val.push(0)
        }
        count++
    })
    return val
}

const activities = [
    'Belanja Kebutuhan',
    'Memasak',
    'Membayar Tagihan',
    'Membersihkan Rumah',
    'Memperbaiki Rumah/Kelistrikan/Perabotan',
    'Mencuci Baju',
    'Mencuci Piring',
    'Mengasuh Anak'
]

const handler = {
    post: {
        auth: 'jwt_strategy',
        handler: async (request, h) => {
            const loadModel = async (request, h) => {
                const handler = tfn.io.fileSystem(path.join(__dirname, './tfjs/model.json'))
                const model = await tf.loadLayersModel(handler)
                return model
            }

            const payload = request.payload
            const data = prepareData(payload)

            const model = await loadModel()
            const output = model.predict(tf.tensor2d(data, [1, 45], 'float32'))
            const prediction = Array.from(output.dataSync())[0]

            const round = Math.round(prediction)
            const recommendation = [
                activities[round],
                activities[round - 1],
                activities[round + 1]
            ]

            return h.response({
                statusCode: 200,
                status: 'success',
                message: recommendation
            })
        }
    }
}

module.exports = handler
