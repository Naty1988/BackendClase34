const express = require('express');
const { json } = require('express');
const path = require('path')
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const productos = []

const { initializeApp, applicationDefault, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp, FieldValue } = require('firebase-admin/firestore');

const util = require("util");
const parseArgs = require('minimist');
const config = require("./config");

// Importación para Autenticación 

const bcrypt = require('bcrypt');
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const User = require('./models')
const controllersdb = require("./controllersdb");

// Session y cookies

const session = require('express-session')
const cookieParser = require("cookie-parser");
// const MongoStore = require("connect-mongo");
// const bodyParser = require("body-parser");
// // Para acceder al req.body
// app.use(bodyParser.json())
// app.use(bodyParser.urlencoded({ extended: true }));

const routes = require("./routes");
const routeRandom = require("./routeRandom");
const postRandom = require("./routeRandom");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -----
// Session
app.use(
  session({
    secret: config.SESION_PASS,
    cookie: {
      httpOnly: false,
      secure: false,
      maxAge: config.TIEMPO_EXPIRACION,
    },
    rolling: true,
    resave: false,
    saveUninitialized: false,
  })
);



const { faker } = require('@faker-js/faker')
faker.locale = 'es'

// Ruta test con producto fakers

app.get('/test', (req, res) => {

  console.log('ok desde test')
  let id = productos.length ? (productos.length + 1) : 1

  for (let i = 1; i <= 5; i++) {
    productos.push({
      id,
      nombre: faker.animal.type(),
      precio: faker.finance.account(2),
      imagen: faker.image.animals(),
    })
    id++
  }
  console.log('productos  faker a renderizar: ', productos)
  res.render('productos.ejs', { productos })
})


// Ruta para numero random fork:

app.post("/api/randoms", routeRandom.postRandom);


// Inicializar passport

app.use(passport.initialize());
app.use(passport.session());

// Autenticación

function hashPassword(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(10));
}

function isValidPassword(plainPassword, hashedPassword) {
  return bcrypt.compareSync(plainPassword, hashedPassword);
}

const registerStrategy = new LocalStrategy(
  { passReqToCallback: true },
  async (req, username, password, done) => {
    try {
      const existingUser = await User.findOne({ username });

      if (existingUser) {
        return done(null, null);
      }

      const newUser = {
        username,
        password: hashPassword(password),
      };

      const createdUser = await User.create(newUser);
      req.user = username;
      done(null, createdUser);
    } catch (err) {
      console.log("Erro registrando usuario", err);
      done("Error en registro", null);
    }
  }
);

let username

const loginStrategy = new LocalStrategy(async (username, password, done) => {
  try {
    const user = await User.findOne({ username });

    if (!user || !isValidPassword(password, user.password)) {
      return done(null, null);
    }

    done(null, user);
  } catch (err) {
    console.log("Errror login", err);
    done("Error login", null);
  }
});

passport.use("register", registerStrategy);
passport.use("login", loginStrategy);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, done);
});

app.get("/", routes.getLogin);

//  LOGIN
app.get("/login", routes.getLogin);
app.post(
  "/login",
  passport.authenticate("login", { failureRedirect: "/faillogin" }),
  routes.postLogin
);
app.get("/faillogin", routes.getFaillogin);

//  REGISTER
app.get("/register", routes.getSignup);
app.post(
  "/register",
  passport.authenticate("register", { failureRedirect: "/failsignup" }),
  routes.postSignup
);
app.get("/failsignup", routes.getFailsignup);

function checkAuthentication(req, res, next) {
  if (req.isAuthenticated()) {
    next();
  } else {
    res.redirect("/login");
  }
}

// Ruta para objeto process

app.get("/info", checkAuthentication, (req, res) => {
  const { user } = req;

  res.send(`
      Argumentos de entrada: ${parseArgs(process.argv.slice(2))}     
      Nombre de la plataforma / Sistema operativo: ${process.platform}
      Version de Node.js: ${process.version}
      Memoria total reservada: ${util.inspect(process.memoryUsage(), {
        showHidden: false,
        depth: null,
        colors: true,
      })}
      Path de ejecución: ${process.cwd()}
      Process ID: ${process.pid}
      Carpeta del proyecto: ${process.execPath}
  `);
});

//  LOGOUT
app.get("/logout", routes.getLogout);

//  FAIL ROUTE
app.get("*", routes.failRoute);

// ----------

app.set('views', path.join(__dirname + '/views'))
app.set('view engine', 'ejs')

// Para funcionamiento de Socket.io

app.use(express.static(__dirname, + '/public'))



// Configuración firebase

let admin = require("firebase-admin");

let serviceAccount = require("./configFirebase.json");
// const { UserImportBuilder } = require('firebase-admin/lib/auth/user-import-builder');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


let mensajes = []

const traerMensajes = async () => {
  const db = admin.firestore();

  const mensajesDB = db.collection("mensajes");

  try {

    const userSnapshot = await mensajesDB.get()
    const mensajeDoc = userSnapshot.docs

    let response = mensajeDoc.map(mj => ({
      id: mj.id,
      author: mj.data().author,
      text: mj.data().text
    }))

    mensajes = response

    console.log("mensajes ", mensajes)

  } catch (err) {
    console.log(err);
  }
}

const guardarMensaje = async (mensaje) => {

  const db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });

  const mensajesDB = db.collection("mensajes");
  try {
    const newMensaje = mensajesDB.doc();
    await newMensaje.create({ author: { alias: mensaje.author.alias, apellido: mensaje.author.apellido, edad: mensaje.author.edad, id: mensaje.author.id, avatar: mensaje.author.avatar, nombre: mensaje.author.nombre }, text: mensaje.text });

    console.log('mensaje guardado en Firebase')
  } catch (err) {
    console.log(err);
  }
}

// Socket.io

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('client:producto', producto => {
    console.log('producto recibido en el servidor: ', producto)
    productos.push(producto)
    console.log('producto pusheado: ', productos)
    io.emit('server:productos', productos)
  })

  socket.on('client:mensaje', mensaje => {

    console.log('mensaje recibido en el servidor: ', mensaje)

    mensajes.push(mensaje)
    console.log('mensaje pusheado: ', mensajes)

    guardarMensaje(mensaje)

    traerMensajes()

    io.emit('server: mensajes', mensajes)
  })

})

const port = 3000;

controllersdb.conectarDB(config.URL_BASE_DE_DATOS_CONECTARDB, (err) => {
  if (err) return console.log("error en conexión de base de datos", err);
  console.log("BASE DE DATOS CONECTADA");

  app.listen(config.PORT, (err) => {
    if (err) return console.log("error en listen server", err);
    console.log(`Server running on port ${config.PORT}`);
  });
});