const express = require('express')
const path = require('path')
const cors = require('cors')
const PORT = process.env.PORT || 8085
const app = express();
const server = require("http").createServer(app);
let io = require("socket.io")(server);

app.use(cors())
app.use(express.static(path.join(__dirname, 'public')))
app.set('views', path.join(__dirname, 'views'))
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.render('pages/index'))
app.get('/room-search', (req, res) => res.render('pages/room-search'))
app.get('/game', (req, res) => res.render('pages/game'))
app.get('/winner', (req, res) => res.render('pages/winner'))
app.get('/losser', (req, res) => res.render('pages/losser'))

require("./socket/socket")(io);
server.listen(PORT, console.log(`Server started on port ${PORT}`));
