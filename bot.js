var irc = require('irc'),
    fs = require('fs'),
    request = require('request'),
    express = require('express'),
    app = express(),
    rc = require('./rc'),
    client, responses = [], urls = {};

var n = JSON.parse(fs.readFileSync(__dirname + '/responses.txt', 'utf8'));
for( var i = 0; i < n.length; i++ ) {
	responses.push(n[i]);
}
urls = JSON.parse(fs.readFileSync(__dirname + '/urls.txt', 'utf8')) || {}; 

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
	fs.writeFile('urls.txt', JSON.stringify(urls, null, "\t"), function(err) {
		if(err) {
			throw err;
		} else {
			console.log("URLs saved");
		}
	});
}, 50000);

client.addListener('message#', function(nick, target, text, message) {
	console.log(nick, target, text);
	if(text.toUpperCase() !== text || !/[A-Z]/.test(text) || !(text.length > 6) || rc.blnicks.indexOf(nick) !== -1 ) {
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

client.addListener('nick', function(onick, nnick, channels) {
	if(rc.blnicks.indexOf(onick) === -1) {
		return;
	}
	rc.blnicks.push(nnick);
});

client.addListener('message#', function(nick, target, text, message) {
	if(/^\.bots/.test(text)) {
		client.say(target, "Reporting in!");
		return;
	}
	if(/^\.shorten/.test(text)) {
		var url = text.split(" ")[1]
		if(typeof urls[url] === "undefined") {
			request("http://waa.ai/api.php?url=" + url, function(e,r,b) {
				if(e) {
					console.error(e);
				}
				client.say(target, b);
				urls[url] = b;
			});
		} else {
			client.say(target, urls[url]);
		}
		return;
	}
	if(/^\.gh/.test(text)) {
		var user = text.split(" ")[1];
		request("https://api.github.com/users/" + user + "/repos", function(e,r,b) {
			var json = JSON.parse(b) || {},
			    index, repo,
			    channel = target;
			client.say(channel, irc.colors.codes.light_gray + user + irc.colors.codes.reset + " has " + irc.colors.codes.light_red + json.length + irc.colors.codes.reset + " repos.");
			for(index = 0; index < json.length; index++) {
				repo = json[index];
				if(index < 3) {
					client.say(channel, irc.colors.codes.light_magenta + repo.name + irc.colors.codes.reset + " " + " " + repo.description.trim() + " (" + irc.colors.codes.light_blue + ( typeof repo.language !== "undefined" ? repo.language : "None" ) + irc.colors.codes.reset + ")");
				} else {
					client.say(channel, "Too many repositories, stopping here...");
					return;
				}
			}
		});
		return;
	}
});

app.configure(function() {
	app.use(express.bodyParser());
	app.use(express.logger());
});

app.post('/', function(req, res) {
	var payload = JSON.parse(req.body.payload);
	rc.channels.forEach(function(channel) {
		client.say(channel, irc.colors.codes.light_gray + payload.repository.name + irc.colors.codes.reset + " (" + irc.colors.codes.light_blue + payload.repository.language + irc.colors.codes.reset + ") had " + payload.commits.length + " commit" + ( payload.commits.length > 1 ? "s" : "" ) + " added.");
		payload.commits.forEach(function(commit) {
			client.say(channel, irc.colors.codes.light_magenta + "[" + commit.author.name + "]" + irc.colors.codes.reset + " " + commit.message.replace(/\n/gim, " ") + " " + irc.colors.codes.light_green + "[" + payload.ref.split('/')[payload.ref.split("/").length-1] + "]" + irc.colors.codes.reset + " " + irc.colors.codes.light_blue + commit.url);
		});
	});
});


app.listen(8181);
