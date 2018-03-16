/*
Project 02_05_01

Author: Jordan R. Stewart
Date: February 15, 2018

Filename: main.js

Description: An IIFE, dynamically creates content for the interface of note operations,
            issues AJAX calls for the server.
*/
(function() { //JRS -  IIFE (Imediately Invoked Function Expression) used to keep all variables seperate from the global scope.
  var selectedUserId; //JRS -  active Id for user.
  var cache = {}; //JRS -  cache for notes.

  function startup() { //JRS - on startup, builds up the Notes section and brings up unique notes based off of the friend you've selected.
    var friends = document.getElementsByClassName('friend');
    for (var i = 0; i < friends.length; i++) {
      friends[i].addEventListener("click", function() { //JRS -  handles a click event on a user, and selects their twitter id.
        for (var j = 0; j < friends.length; j++) {
          friends[j].className = 'friend';
        }
        this.className += ' active';
        selectedUserId = this.getAttribute('uid');
        var notes = getNotes(selectedUserId, function(notes) {
          var docFragment = document.createDocumentFragment();
          var notesElements = createNotesElements(notes);
          notesElements.forEach(function(element) { //JRS - for each note, appendChild to a newly created li element.
            docFragment.appendChild(element);
          });
          var newNoteButton = createAddNoteButton();
          docFragment.appendChild(newNoteButton);
          document.getElementById('notes').innerHTML = ""; //JRS -  sets any notes in the note elements to nothing.
          document.getElementById('notes').appendChild(docFragment);
          console.log(notes);
        });
      });
    }
  };

function createNotesElements(notes) { //JRS - maps the data into a newly created li element.
    return notes.map(function(note) {
      var element = document.createElement('li');
      element.className = "note";
      element.setAttribute('contenteditable', true);
      element.textContent = note.content;
      element.addEventListener('blur', function() {
        note.content = this.textContent;
        if (note.content == "") {
          if (note._id) {
            deleteNote(selectedUserId, note, function() {
              document.getElementById('notes').removeChild(element);
            });
          }
          else {
            document.getElementById('notes').removeChild(element);
          }
        }
        else if (!note._id) {
          postNewNote(selectedUserId, {content: this.textContent}, function(newNote) {
            note._id = newNote._id;
          });
        }
        else {
          putNote(selectedUserId, note, function() {} );
        }
      });
      element.addEventListener('keydown', function(e) { //JRS - creates a new note when user clicks enter.
        if (e.keyCode == 13) {
          e.preventDefault();
          if (element.nextSibling.className == "add-note") {
            element.nextSibling.click();
          }
          else {
            element.nextSibling.focus();
          }
        }
      });
      return element;
    });
}

function createAddNoteButton() { //JRS - creates an li that askes to create a new note.
  var element = document.createElement('li');
  element.className = "add-note";
  element.textContent = 'Add a new note ...';
  element.addEventListener('click', function() {
    var noteElement = createNotesElements([{}])[0];
    document.getElementById('notes').insertBefore(noteElement, this);
    noteElement.focus();
  });
  return element;
}

function getNotes(userId, callback) { //JRS - creates a AJAX request that creates a unique url based off the returned friend id's.
  if (cache[userId]) {
    return callback(cache[userId]);
  }
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      var notes = JSON.parse(xhttp.responseText || []);
      cache[userId] = notes;
      callback(notes);
    }
  };
  xhttp.open('GET', '/friends/' + encodeURIComponent(userId) + '/notes', true);
  xhttp.send();
}


function postNewNote(userId, note, callback) { //JRS - Creates an AJAX Post which cache's any notes in JSON, will generate a unique id for the note.
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      var serverNote = JSON.parse(xhttp.responseText || {});
      cache[userId].push(serverNote);
      callback(serverNote);
    }
  }
  xhttp.open('POST', '/friends/' + encodeURIComponent(userId) + '/notes', true);
  xhttp.setRequestHeader('Content-Type', "application/json;charset=UTF-8");
  xhttp.send(JSON.stringify(note));
}

function putNote(userId, note, callback) { //JRS - Creates an AJAX PUT request that will update the data in the server with any new data placed in a note.
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      var serverNote = JSON.parse(xhttp.responseText || {});
      callback(serverNote);
    }
  }
  xhttp.open('PUT', '/friends/' + encodeURIComponent(userId) + '/notes/' + encodeURIComponent(note._id), true);
  xhttp.setRequestHeader('Content-Type', "application/json;charset=UTF-8");
  xhttp.send(JSON.stringify(note));
}

function deleteNote(userId, note, callback) { //JRS - Creates an AJAX DELETE request that will go and will delete the data stored in the database if a note field is empty.
  var xhttp = new XMLHttpRequest();
  xhttp.onreadystatechange = function() {
    if (xhttp.readyState == 4 && xhttp.status == 200) {
      cache[userId] = cache[userId].filter(function(localNote) {
        return localNote._id != note._id;
      });
      callback();
    }
  }
  xhttp.open('DELETE', '/friends/' + encodeURIComponent(userId) + '/notes/' + encodeURIComponent(note._id), true);
  xhttp.send();
}

document.addEventListener('DOMContentLoaded', startup, false);
})();
