const fs = require('fs');
const path = require('path');
const DATA = path.join(__dirname, 'users.json');

function readUsers(){
  try {
    return JSON.parse(fs.readFileSync(DATA, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeUsers(users){
  fs.writeFileSync(DATA, JSON.stringify(users, null, 2), 'utf8');
}

module.exports = { readUsers, writeUsers };
