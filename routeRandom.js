// Ruta para numero random fork:
const { fork } = require("child_process");

const calc = fork("routeRandomChild");

function postRandom(req, res) {

    let cant = req.query.cant
    if (cant === "") {
        cant = 1000000
    }
    calc.send(cant);
    calc.on("message", numbers => {
        console.log(numbers)
        res.json(numbers)
    } );
}

module.exports = {postRandom };