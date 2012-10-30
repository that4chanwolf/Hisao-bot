var irc = require('irc'),
    fs = require('fs'),
    rc = require('./rc'),
    client, responses = [];

var n = JSON.parse(fs.readFileSync(__dirname + '/responses.txt', 'utf8'));
for( var i = 0; i < n.length; i++ ) {
	console.log(n[i]);
	responses.push(n[i]);
}

client = new irc.Client(rc.network, rc.nick, {
	userName: rc.user,
	realName: rc.real,
	channels: rc.channels
});

client.addListener('registered', function() {
	console.log('Registered');
	if(typeof rc.ns !== 'undefined' && rc.ns !== null && rc.ns !== '') {
		client.say('NickServ', 'identify ' + rc.ns);
	}
});

var writeInterval = setInterval(function() {
	fs.writeFile('responses.txt', JSON.stringify(responses), function(err) {
		if(err) {
			throw err;
		} else {
			console.log("Responses saved!");
		}
	});
}, 50000);

client.addListener('message', function(nick, target, text, message) {
	console.log(nick, target, text);
	if(text.toUpperCase() !== text) {
		return;
	}
	for (var i = 0, n = text.length; i < n; i++) {
		if (text.charCodeAt( i ) > 255) { 
			return; 
		}
	}
	if(responses !== []) {
		client.say(target, responses[Math.floor(Math.random()*responses.length)]);
	}
	responses.push(text);
});

client.addListener('message', function(nick, target, text, message) {
	if(!/^\.bots/.test(text)) {
		return;
	}
	client.say(target, "Reporting in!");
});