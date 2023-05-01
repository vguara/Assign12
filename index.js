
require("./utils.js");

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 12;
var urlencodedParser = bodyParser.urlencoded({ extended: false });

const PORT = process.env.PORT || 3000;

const app = express();




const Joi = require("joi");


const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const mongodb_connection_string = process.env.MONGO_CONNECTION_STRING;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

// Connect to MongoDB
console.log(process.env.MONGO_CONNECTION_STRING)
mongoose.connect(mongodb_connection_string, { useNewUrlParser: true });
const db = mongoose.connection;

var {database} = include('databaseConnection');

const userCollection = database.db(mongodb_database).collection('users');

app.use(express.urlencoded({extended: false}));

var mongoStore = MongoStore.create({
	mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/sessions`,
	crypto: {
		secret: mongodb_session_secret
	}
})

app.use(session({ 
    secret: node_session_secret,
	store: mongoStore, //default is memory store 
	saveUninitialized: false, 
	resave: true
}
));



app.get('/', (req,res) => {
	var html ="";
	if (!req.session.authenticated) {
		html = '<form action=/signup><button>Signup</button></form><br/>'
		+ '<form action=/login><button>Login</button></form>'
       
    } else {
		username = 
		html = '<p> Hello, ' + req.session.username + '</p>'
			+ '<form action=/members><button> Go to member Area</button></form><br/>'
			+ '<a href=/logout><button href=/>Logout<button></a><br/>'
	}

	res.send(html);
});


app.get('/signup', (req,res) => {
    var html = `
    create user
    <form action='/submitUser' method='post'>
    <input name='username' type='text' placeholder='username'>
	<input name='email' type='email' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});


app.get('/login', (req,res) => {
    var html = `
    log in
    <form action='/loggingin' method='post'>
    <input name='email' type='email' placeholder='email'>
    <input name='password' type='password' placeholder='password'>
    <button>Submit</button>
    </form>
    `;
    res.send(html);
});

app.post('/submitUser', urlencodedParser, async (req,res) => {
    var username = req.body.username;
	var email = req.body.email;
    var password = req.body.password;

	if (!username) {
		res.redirect('/signupcheck?missingField=username');
		return;
	  }
	
	  if (!email) {
		res.redirect('/signupcheck?missingField=email');
		return;
	  }
	
	  if (!password) {
		res.redirect('/signupcheck?missingField=password');
		return;
	  }

	const schema = Joi.object(
		{
			username: Joi.string().alphanum().max(20).required(),
			password: Joi.string().max(20).required(),
			email: Joi.string().email().required()
		});
	
	const validationResult = schema.validate({username, password, email});
	if (validationResult.error != null) {
	   console.log(validationResult.error);
	   res.redirect("/signup");
	   return;
   }

    var hashedPassword = await bcrypt.hash(password, saltRounds);
	
	await userCollection.insertOne({username: username, email:email, password: hashedPassword});
	console.log("Inserted user");

	req.session.authenticated = true;
	req.session.username = username;
	req.session.email = email;
	req.session.cookie.maxAge = expireTime;

    res.redirect('/members');
});

app.post('/loggingin', async (req,res) => {
    var email = req.body.email;
    var password = req.body.password;

	const schema = Joi.string().max(20).required();
	const schema2 = Joi.string().email().required();
	const validationResult = schema.validate(password);
	const validationResult2 = schema2.validate(email);

	if ((validationResult.error && validationResult2.error) != null) {
	   console.log(validationResult.error);
	   res.redirect("/login");
	   return;
	}

	const result = await userCollection.find({email: email}).project({email: 1, password: 1, username:1, _id: 1}).toArray();

	console.log(result);
	if (result.length != 1) {
		console.log("user not found");
		res.redirect("/login");
		return;
	}
	if (await bcrypt.compare(password, result[0].password)) {
		console.log("correct password");
		req.session.authenticated = true;
		req.session.email = email;
		req.session.username = result[0].username;
		req.session.cookie.maxAge = expireTime;

		res.redirect('/members');
		return;
	}
	else {
		console.log("incorrect password");
		var html ='<p> Incorrect email/password combination</p>'
				+ '<a href=/login>Try Again</a>';
		res.send(html);
		return;
	}
});

app.get('/signupcheck', (req, res) => {
	const missingField = req.query.missingField;
  
	var html = `
	  ${missingField} is required<br><br>
	  <a href="/signup">Try again</a>
	`;
  
	res.send(html);
  });

app.get('/loggedin', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/login');
    }
    var html = `
    You are logged in!
    `;
    res.send(html);

	res.redirect('/members');


});

app.use('/public', express.static('public'));

app.get('/members', (req,res) => {
    if (!req.session.authenticated) {
        res.redirect('/');
    }
	const images = ['cat1.gif', 'cat2.gif', 'cat3.gif'];
	const randomIndex = Math.floor(Math.random() * images.length);
	// const imageUrl = `/public/${images[randomIndex]}`;
	const imageUrl = `${req.protocol}://${req.hostname}/public/${images[randomIndex]}`;
    var html = '<h1>Hello, ' + req.session.username + '</h1>'
				+ `<img src="${imageUrl}" alt="Random Image">`
				+ '<form action=/logout><button>Logout</button></form>';
    res.send(html);
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    res.redirect('/');
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req,res) => {
	res.status(404);
	res.send("Page not found - 404");
})

// Handle MongoDB connection error
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
// Handle MongoDB connection success
db.once('open', function() {
  console.log('MongoDB connected!');
  
  // Listen to requests
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
});