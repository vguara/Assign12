
require("./utils.js");

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const saltRounds = 12;
var urlencodedParser = bodyParser.urlencoded({ extended: false });

const port = process.env.PORT || 3000;

const app = express();


const Joi = require("joi");


const expireTime = 24 * 60 * 60 * 1000; //expires after 1 day  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* END secret section */

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

var numPageHits = 0;



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




// app.get('/nosql-injection', async (req,res) => {
// 	var username = req.query.user;

// 	if (!username) {
// 		res.send(`<h3>no user provided - try /nosql-injection?user=name</h3> <h3>or /nosql-injection?user[$ne]=name</h3>`);
// 		return;
// 	}
// 	console.log("user: "+username);

// 	const schema = Joi.string().max(20).required();
// 	const validationResult = schema.validate(username);

// 	//If we didn't use Joi to validate and check for a valid URL parameter below
// 	// we could run our userCollection.find and it would be possible to attack.
// 	// A URL parameter of user[$ne]=name would get executed as a MongoDB command
// 	// and may result in revealing information about all users or a successful
// 	// login without knowing the correct password.
// 	if (validationResult.error != null) {  
// 	   console.log(validationResult.error);
// 	   res.send("<h1 style='color:darkred;'>A NoSQL injection attack was detected!!</h1>");
// 	   return;
// 	}	

// 	const result = await userCollection.find({username: username}).project({username: 1, password: 1, _id: 1}).toArray();

// 	console.log(result);

//     res.send(`<h1>Hello ${username}</h1>`);
// });

// app.get('/about', (req,res) => {
//     var color = req.query.color;

//     res.send("<h1 style='color:"+color+";'>Patrick Guichon</h1>");
// });

// app.get('/contact', (req,res) => {
//     var missingEmail = req.query.missing;
//     var html = `
//         email address:
//         <form action='/submitEmail' method='post'>
//             <input name='email' type='text' placeholder='email'>
//             <button>Submit</button>
//         </form>
//     `;
//     if (missingEmail) {
//         html += "<br> email is required";
//     }
//     res.send(html);
// });

// app.post('/submitEmail', (req,res) => {
//     var email = req.body.email;
//     if (!email) {
//         res.redirect('/contact?missing=1');
//     }
//     else {
//         res.send("Thanks for subscribing with your email: "+email);
//     }
// });


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
	   res.redirect("/createUser");
	   return;
   }

    var hashedPassword = await bcrypt.hash(password, saltRounds);
	
	await userCollection.insertOne({username: username, email:email, password: hashedPassword});
	console.log("Inserted user");

    var html = "successfully created user";
    res.send(html);
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

	const result = await userCollection.find({email: email}).project({email: 1, password: 1, _id: 1}).toArray();

	console.log(result);
	if (result.length != 1) {
		console.log("user not found");
		res.redirect("/login");
		return;
	}
	if (await bcrypt.compare(password, result[0].password)) {
		console.log("correct password");
		req.session.authenticated = true;
		req.session.username = username;
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
	const imageUrl = `/public/${images[randomIndex]}`;
    var html = '<h1>Hello, ' + req.session.username + '</h1>'
				+ `<img src="${imageUrl}" alt="Random Image">`
				+ '<form action=/logout><button>Logout</button></form>';
    res.send(html);
});

app.get('/logout', (req,res) => {
	req.session.destroy();
    res.redirect('/');
});


// app.get('/cat/:id', (req,res) => {

//     var cat = req.params.id;

//     if (cat == 1) {
//         res.send("Fluffy: <img src='/fluffy.gif' style='width:250px;'>");
//     }
//     else if (cat == 2) {
//         res.send("Socks: <img src='/socks.gif' style='width:250px;'>");
//     }
//     else {
//         res.send("Invalid cat id: "+cat);
//     }
// });


app.use(express.static(__dirname + "/public"));

app.get("*", (req,res) => {
	res.status(404);
	res.send("Page not found - 404");
})

app.listen(port, () => {
	console.log("Node application listening on port "+port);
}); 