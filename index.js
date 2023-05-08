
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

app.set('view engine', 'ejs');


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

function isAdmin(req, res) {
	if (req.session.usertype === "admin") {
		return true;
	} else {
		return false;
	}
}

function adminAuthorization(req,res,next){
	if(isAdmin(req)){
		next();
	} else {
		res.status(403);
		res.render('error', {error: "You are not authorized to view this page"})
		return;
	}
}

function isSessionValid(req){
	if (req.session.authenticated) {
		return true;
	} else {
		return false;
	}
}

function sessionValidation(req,res,next){
	if(isSessionValid(req)){
		next();
	} else {
		res.redirect('/login');
	}
}
	
app.use('/loggedin', sessionValidation);

app.get('/', (req,res) => {

	isSessionValidResult = isSessionValid(req);
	let user = null;

	if (isSessionValidResult) {
		user = req.session.username;
	};

	res.render('index',{ isSessionValid: isSessionValidResult, user });
});


app.get('/signup', (req,res) => {

	var isSessionValid = req.session.authenticated;
	var missingFields = false;
    res.render('signup', {missingFields: missingFields, isSessionValid: isSessionValid});
});


app.get('/login', (req,res) => {

	var incorrect = false;
	
	var isSessionValid = req.session.authenticated;

	if (!isSessionValid) {
    	res.render('login', {incorrect: incorrect, isSessionValid: isSessionValid});
	} else {
		res.redirect('/members');
	};

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
	
	await userCollection.insertOne({username: username, email:email, password: hashedPassword, usertype: "user"});
	console.log("Inserted user");

	req.session.authenticated = true;
	req.session.username = username;
	req.session.email = email;
	req.session.usertype = "user";
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

	const result = await userCollection.find({email: email}).project({email: 1, password: 1, username:1, usertype:1, _id: 1}).toArray();

	console.log(result);

	if (result.length === 1) {
		const isPasswordValid = await bcrypt.compare(password, result[0].password);
		if (isPasswordValid) {
			console.log("correct password");
			req.session.authenticated = true;
			req.session.email = email;
			req.session.username = result[0].username;
			req.session.usertype = result[0].usertype;
			req.session.cookie.maxAge = expireTime;

			var incorrect = false;
	
			res.redirect('/members');
			return;
		}
	}
	console.log("incorrect email or password");

	var isSessionValid = req.session.authenticated;
	var incorrect = true;
	res.render ('login', {incorrect: incorrect, isSessionValid: isSessionValid});
	return;


});

app.get('/signupcheck', (req, res) => {
	const missingField = req.query.missingField;
	const missingFields = true;
  
	res.render('signup', {missingField: missingField, missingFields: missingFields});
  });




app.get('/loggedin', (req,res) => {
	res.redirect('/members');

});

app.use('/public', express.static('public'));


/////////////////////////////middleware/////////////////////////////////////

app.get('/admin', sessionValidation, adminAuthorization, async (req,res) => {
	
	var users = await userCollection.find().project({username: 1, usertype:1, _id: 0}).toArray();

	res.render('admin', {users: users});


});

app.post('/promoteUser/:user', async (req,res) => {

	var username = req.params.user;

	userCollection.updateOne({username: username}, {$set: {usertype: "admin"}});

	res.redirect('/admin');

});

app.post('/demoteUser/:user', async (req,res) => {

	var username = req.params.user;

	userCollection.updateOne({username: username}, {$set: {usertype: "user"}});

	res.redirect('/admin');

});

/////////////////////////////middleware/////////////////////////////////////

app.get('/members', sessionValidation, (req,res) => {
	var user = req.session.username;
    res.render('members', {user: user});
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    res.redirect('/');
});

app.use(express.static(__dirname + "/public"));

app.get("*", (req,res) => {
	res.status(404);
	isSessionValid = req.session.authenticated;
	res.render('404', {isSessionValid: isSessionValid});
});

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