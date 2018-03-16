/*
Exercise 02_03_01

Author: Jordan R. Stewart
Date: January 22, 2018

Filename: index.js

Description: Node Server
*/
var url = require('url');
var express = require('express');
var bodyParser = require('body-parser');
var authenticator = require("./authenticator.js");
var storage = require('./storage.js')
var config = require("./config.json");
var app = express();
var querystring = require('querystring');
var async = require('async');
var MongoClient = require('mongodb').MongoClient;

storage.connect();

app.set('view engine', 'ejs');

setInterval(function(){ //JRS - clears the cache of MongoDB every 5 minutes
  if (storage.connected()) {
    console.log('clearing mongodb cache');
    storage.deleteFriends();
  }
}, 1000 * 60 * 5);

app.use(require('cookie-parser')());

app.use(bodyParser.json());

//JRS - local host link that will callback to the twitter page via redirectToTwitterLoginPage function from authenticator.js
app.get('/auth/twitter', authenticator.redirectToTwitterLoginPage); //JRS - gets the code from the module.export authenticator.js file
app.get(url.parse(config.oauth_callback).path, function(req, res) { //JRS - call back for twitter to /request_token

      authenticator.authenticate(req, res, function(err) {
        if (err) {
          res.redirect('/login');
          res.sendStatus(401); //JRS - sends a client error code
        }
        else {
          res.redirect('/');
        }
    });
});

//JRS - authenticates and then post's a tweet on the logged in twitter user's account
app.get('/tweet', function(req, res){
    var credentials = authenticator.getCredentials();
    if (!credentials.access_token || !credentials.access_token_secret) {
      return res.sendStatus(401);
    }
    var url = "https://api.twitter.com/1.1/statuses/update.json";
    authenticator.post(url, credentials.access_token, credentials.access_token_secret,
      {
        status: "This is a test tweet for an automated status messenger in a node.js project!"
      },
      function(error, data) {
        if (error) {
          return res.status(400).send(error);
        }
        res.send('Tweet successful!');
      }
  );
});

//JRS - Tweet search
app.get('/search', function(req, res){
  var credentials = authenticator.getCredentials();
  if (!credentials.access_token || !credentials.access_token_secret) {
    return res.sendStatus(401);
  }
  var url = "https://api.twitter.com/1.1/search/tweets.json";
  var query = querystring.stringify({ q: "Tesla" });
  url += "?" + query;
  authenticator.get(url, credentials.access_token, credentials.access_token_secret,
    function(error, data) {
      if (error) {
        return res.status(400).send(error);
      }
      res.send(data);
    });
});

app.get('/friends', function(req, res){
  var credentials = authenticator.getCredentials();
  if (!credentials.access_token || !credentials.access_token_secret) {
    return res.sendStatus(401);
  }
  var url = "https://api.twitter.com/1.1/friends/list.json";
  if (req.query.cursor) {
      url += "?" + querystring.stringify({ cursor: req.query.cursor });
  }
  authenticator.get(url, credentials.access_token, credentials.access_token_secret,
    function(error, data) {
      if (error) {
        return res.status(400).send(error);
      }
      res.send(data);
    });
});

app.get('/', function(req, res) { //JRS - Main endpoint
  var credentials = authenticator.getCredentials();
  if (!credentials.access_token || !credentials.access_token_secret) {
    return res.redirect('/login');
  }
  if (!storage.connected()) {
      console.log('loading friends from Twitter');
      return renderMainPageFromTwitter(req, res);
    }
    console.log('loading friends from MongoDB');
    storage.getFriends(credentials.twitter_id, function(err, friends) {
      if (err) {
        return res.status(500).send(err);
      }
      if (friends.length > 0) { //JRS - gets rid of nonexistent friends
        console.log('Friends successfully loaded from MongoDB.');
        friends.sort(function(a, b) {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        });
        res.render('index', { friends: friends })
      }
      else {
        console.log('loading friends from Twitter');
        renderMainPageFromTwitter(req, res);
      }
    });
});

app.get('/login', function(req, res) {
  authenticator.clearCredentials();
  if (storage.connected()) {
    console.log('Deleting friends collection on login');
    storage.deleteFriends();
  }
  res.render('login');
});

function renderMainPageFromTwitter(req, res) {
  var credentials = authenticator.getCredentials();
  async.waterfall([
      //JRS - get friends ids
      function(callback) {
          //JRS - starting point of the cursor
          var cursor = -1;
          var ids = [];  //JRS - holds our returned data
          async.whilst(function() { //JRS - async while loop, paramter 1 sets loop conditions
              return cursor != 0;
          }, function(callback) { //JRS - parameter 2 acts a the workhorse
              var url = "https://api.twitter.com/1.1/friends/ids.json";
              url += "?" + querystring.stringify({
                  user_id: credentials.twitter_id,
                  cursor:  cursor
              });
              authenticator.get(url, credentials.access_token, credentials.access_token_secret, function(error, data) {
                  if (error) {
                      return res.status(400).send(error);
                  }
                  data = JSON.parse(data); //JRS - turns the string into json
                  cursor = data.next_cursor_str; //JRS - sets data for next loop
                  ids = ids.concat(data.ids); //JRS - concatinates the data onto the end of the ids in array
                  callback(); //JRS - finishes the loop, goes back to cursor to test whether to run again
              });
          //JRS - parameter 3 is the callback that gets called to finish up the whilst loop
          }, function(error) {
              if (error) {
                  return res.status(500).send(error);
              }
              callback(null, ids);
          });
      },
      //JRS - lookup friends data
      function(ids, callback) {
          //JRS - 'i' is the next hundred
          var getHundreds = function(i) {
              return ids.slice(100*i, Math.min(ids.length, 100*(i+1))); //JRS - returns ids in sets of hundreds
          }
          var requestsNeeded = Math.ceil(ids.length/100); //JRS - tells how many requests are needed to get all the ids
          async.times(requestsNeeded, function(n, next) { //JRS - async method for a for loop
              var url = "https://api.twitter.com/1.1/users/lookup.json";
              url += "?" + querystring.stringify({
                  user_id: getHundreds(n).join(',')
              });
              //JRS - if Authentication is correct then it gets all the tweets on feed using the url and the credentials
              authenticator.get(url, credentials.access_token, credentials.access_token_secret,
                function(error, data) {
                  if (error) {
                      return res.status(400).send(error);
                  }
                  var friends = JSON.parse(data);
                  next(null, friends);
              });
          },
          function(err, friends) {
              friends = friends.reduce(function(previousValue, currentValue, currentIndex, array) {
                return previousValue.concat(currentValue); //JRS - flattens the dimensions of the array.
              }, []);
              friends.sort(function(a, b) { // bubble sort array
                return a.name.toLowerCase().localeCompare(b.name.toLowerCase()); //JRS - lowercases the names and alphabetizes
              });
              friends = friends.map(function(friend) { //JRS - maps the data and returns the data we request
                return {
                  twitter_id: friend.id_str,
                  for_user: credentials.twitter_id,
                  name: friend.name,
                  screen_name: friend.screen_name,
                  location: friend.location,
                  profile_image_url: friend.profile_image_url
                }
              });
              res.render('index', { friends: friends });
              if (storage.connected()) { //JRS - inserts friends into the collection in MongoDB
                storage.insertFriends(friends);
              }
          });
      }
  ]);
};

app.get('/logout', function(req, res) { //JRS - logs out, deletes cached data in MongoDB, and then redirects to login page
  authenticator.clearCredentials();
  res.clearCookie('twitter_id');
  if (storage.connected()) {
    console.log('Deleting friends collection on logout.');
    storage.deleteFriends();
  }
  res.redirect('/login');
});

function ensureLoggedIn(req, res, next) { //JRS - On login, it will create a cookie with the twitter id, Middleware function
  var credentials = authenticator.getCredentials();
  if (!credentials.access_token || !credentials.access_token_secret || !credentials.twitter_id) {
    return res.sendStatus(401);
  }
  res.cookie('twitter_id', credentials.twitter_id, {httponly: true});
  next();
}

app.get('/friends/:uid/notes', ensureLoggedIn, function(req, res) { //JRS - creates a unique route, api that gets our notes from the server storage
  var credentials = authenticator.getCredentials();
  storage.getNotes(credentials.twitter_id, req.params.uid, function(err, notes) {
    if (err) {
        return res.status(500).send(err);
    }
    res.send(notes);
  });
});

app.post('/friends/:uid/notes', ensureLoggedIn, function(req, res) {  //JRS - goes to the route and posts a new note into the note document, and will generate a unique id for that note
  storage.insertNote(req.cookies.twitter_id, req.params.uid, req.body.content, function(err, note) {
    if (err) {
      return res.status(500).send(err);
    }
    res.send(note);
  });
});

app.put('/friends/:uid/notes/:noteid', ensureLoggedIn, function(req, res) { //JRS - retrieves the unique note id and updates the note previously posted
  storage.updateNote(req.params.noteid, req.cookies.twitter_id, req.body.content, function(err, note) {
    if (err) {
      return res.status(500).send(err);
    }
    res.send({
      _id: note._id,
      content: note.content
    });
  });
});

app.delete('/friends/:uid/notes/:noteid', ensureLoggedIn, function(req, res) { //JRS - retrieves the unique note id and deletes the note
  // var credentials = authenticator.getCredentials();
  storage.deleteNote(req.params.noteid, req.cookies.twitter_id, function(err, note) {
    if (err) {
      return res.status(500).send(err);
    }
    res.sendStatus(200);
  });
});

app.use(express.static(__dirname + '/public')); //JRS - method of ExpressJS to set a folder for static content

//JRS - logs progress during server startup
app.listen(config.port, function(){
  console.log('Server listening on localhost:%s', config.port);
  console.log('OAuth callback hostname:' + url.parse(config.oauth_callback).hostname);
  console.log('OAuth callback path:' + url.parse(config.oauth_callback).path);

});
