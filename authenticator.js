/*
Exercise 02_05_01

Author: Jordan R. Stewart
Date: January 23, 2018

Filename: authenticator.js

Description: Module that handles all of the oauth authentications for the application
*/
var OAuth = require('oauth').OAuth;
var config = require("./config.json");
//JRS - we are building an oauth config based off of what we get from twitter
var oauth = new OAuth(
  config.request_token_url,
  config.access_token_url,
  config.consumer_key,
  config.consumer_secret,
  config.oauth_version,
  config.oauth_callback,
  config.oauth_signature
);
//JRS - we are using this to store credentials due to cookies not working, used for storing id's we need for calls.
var twitterCredentials = {
    oauth_token: "",
    oauth_token_secret: "",
    access_token: "",
    access_token_secret: "",
    twitter_id: ""
}
//JRS - Twitter authentication page
module.exports = {
  //JRS - The following is a generic GET for any Twitter RESTful API
  get: function(url, access_token, oauth_access_token_secret, callback){
    oauth.get.call(oauth, url, access_token, oauth_access_token_secret, callback);
  },
  //JRS -  The following is a generic POST for any Twitter RESTful API
  post: function(url, access_token, oauth_access_token_secret, body, callback){
    oauth.post.call(oauth, url, access_token, oauth_access_token_secret, body, callback);
  },
  //JRS - returns the credentials needed for any modules
  getCredentials: function() {
    return twitterCredentials;
  },
  clearCredentials: function() {
    twitterCredentials.oauth_token = "";
    twitterCredentials.oauth_token_secret = "";
    twitterCredentials.access_token = "";
    twitterCredentials.access_token_secret = "";
    twitterCredentials.twitter_id = "";
  },
  //JRS - takes the credentials we recieved, and gives them to twitter to get a token.
    redirectToTwitterLoginPage: function(req, res){
      oauth.getOAuthRequestToken(function(error, oauth_token, oauth_token_secret, results) {
        if (error) {
          console.log(error);
          res.send("Authentication Failed!");
        }
        else {
          //JRS - res.send("Authentication successful!");
          twitterCredentials.oauth_token = oauth_token;
          twitterCredentials.oauth_token_secret = oauth_token_secret;
          res.redirect(config.authorization_url + "?oauth_token=" + oauth_token);
        }
      });
    },
    //JRS - takes our temporary credentials and trades it in for a final access token and gives us our final access code
    authenticate: function(req, res, callback) {
      if (!(twitterCredentials.oauth_token && twitterCredentials.oauth_token_secret &&
         req.query.oauth_verifier)) {
        return callback('Request does not have all required keys.');
      }

      oauth.getOAuthAccessToken(twitterCredentials.oauth_token, twitterCredentials.oauth_token_secret, req.query.oauth_verifier,
        function(error, oauth_access_token, oauth_access_token_secret, results) {
          if (error) {
            return callback(error);
          }
          var url = "https://api.twitter.com/1.1/account/verify_credentials.json";
          oauth.get(url, oauth_access_token, oauth_access_token_secret, function(error, data){
            if (error) {
              console.log(error);
              callback(error);
            }
            data = JSON.parse(data);
            // console.log(data);
            twitterCredentials.access_token = oauth_access_token;
            twitterCredentials.access_token_secret = oauth_access_token_secret;
            twitterCredentials.twitter_id = data.id_str;
            callback();
        });
      });
    }
};
