function getRoot(req, res) {}

function getLogin(req, res) {
  if (req.isAuthenticated()) {
    var user = req.user;
    console.log("user logueado");
    res.render("main", {
      usuario: user.username,
      nombre: user.firstName,
      apellido: user.lastName,
      email: user.email,
    });
  } else {
    console.log("user NO logueado");
    res.sendFile(__dirname + "/views/login.html");
  }
}

function getSignup(req, res) {

  res.sendFile(__dirname + "/views/registro.html");
}

function postLogin(req, res) {
  var user = req.user.username;
  res.render('main.ejs', { user })
}

function postSignup(req, res) {
  var user = req.user;
  res.sendFile(__dirname + "/views/login.html");
}

function getFaillogin(req, res) {
  console.log("error en login");
  res.render("login-error.ejs", {});
}

function getFailsignup(req, res) {
  console.log("error en signup");
  res.render('failRegister.ejs')
}

function getLogout(req, res) {
  req.logout(function(err) {
    if (err) { return next(err); }
    res.redirect('/')
  });  
}

function failRoute(req, res) {
  res.status(404).render("failRegister", {});
}

module.exports = {
  getRoot,
  getLogin,
  postLogin,
  getFaillogin,
  getLogout,
  failRoute,
  getSignup,
  postSignup,
  getFailsignup,
};