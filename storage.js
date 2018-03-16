/*
Exercise 02_03_01

Author: Jordan R. Stewart
Date: January 22, 2018

Filename: index.js

Description: Contains all the functionality to deal with database operations
*/
var MongoClient = require('mongodb').MongoClient; //JRS - Nodejs driver for MongoDB.
var ObjectID = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/storage';
var dbName = 'Twitter_notes';
var database; //JRS - Connection to the database.


module.exports = { //JRS - establishes database connection.
    connect: function() {
      MongoClient.connect(url, function(err, client){
        if (err){
          return console.log('Error: ' + err);
        }
        database = client.db(dbName);
        console.log('Connected to database: ' + dbName);
      });
    },
    connected: function() {
      return typeof database != 'undefined'; //JRS - used to find out what kind of data is stored, and doesn't store data if the user recieves an undefined.
    },
    insertFriends: function(friends) { //JRS - creates the collection.
      database.collection('friends').insert(friends, function(err) {
        if (err){
          return console.log('Cannot insert friends into database');
        }
      });
    },
    getFriends: function(userId, callback) { //JRS - reads the collection.
      var cursor = database.collection('friends').find({
        for_user: userId
      });
      cursor.toArray(callback);
    },
    deleteFriends: function() { //JRS - deletes the collection.
      database.collection('friends').remove(( {} ), function(err) {
        if (err) {
          console.log('Cannot remove friends from database.');
        }
      }); //JRS - dumps the json
    },
    getNotes: function(ownerid, friendid, callback) { //JRS - Gets the notes collection and returns the content in an array, which then gets filtered to return the note id, and the content of that note.
      var cursor = database.collection('notes').find({
        owner_id: ownerid,
        friend_id: friendid
      });
      cursor.toArray(function (err, notes) {
        if (err) {
          return callback(err);
        }
        callback(null, notes.map(function(note) {
          return {
            _id: note._id,
            content: note.content
          }
        }));
      });
    },
    insertNote: function(ownerid, friendid, content, callback) { //JRS - Inserts the data sent from the AJAX request into the notes collection and will return the a note id and the content of that note.
      database.collection('notes').insert({
        owner_id: ownerid,
        friend_id: friendid,
        content: content
      }, function(err, result) {
        if (err){
          return callback(err, result);
        }
        callback(null, {
          _id: result.ops[0]._id,
          content: result.ops[0].content
        });
      });
    },
    updateNote: function(noteid, ownerid, content, callback) { //JRS - Updates the data in a note with any updated data by setting the content to the content recieved from the AJAX request and will generate a new id for the previously updated note.
      database.collection('notes').updateOne({
        _id: new ObjectID(noteid),
        owner_id: ownerid},
        {
            $set: {content: content}
        },
        function (err, results) {
          if (err) {
            callback(err);
          }
        database.collection('notes').findOne({
            _id: new ObjectID(noteid),
        }, callback);
      });
    },
    deleteNote: function(noteid, ownerid, callback) { //JRS - Deletes the note from the database after recieving the AJAX request to delete the empty record.
      database.collection('notes').deleteOne({
        _id: new ObjectID(noteid),
        owner_id: ownerid}, callback);
    }
}
