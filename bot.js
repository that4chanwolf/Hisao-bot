var irc = require('irc'),
    fs = require('fs'),
    net = require('net'),
    os = require('os'),
    crypto = require('crypto'),
    request = require('request'),
    express = require('express'),
    format = require('format'),
    app = express(),
    rc = require('./rc'),
    client, responses = [], urls = {},
    DCCPORT = 5555,
    DCCMAX = 55554;

var n = JSON.parse(fs.readFileSync(__dirname + '/responses.txt', 'utf8'));
for( var i = 0; i < n.length; i++ ) {
	responses.push(n[i]);
}
urls = JSON.parse(fs.readFileSync(__dirname + '/urls.txt', 'utf8')) || {}; 

var ip2int = function(dotted) { // Takes an IP adress and turns it into the format needed for DCC chats
	var exp = 3,
	    intip = 0;

	var split = dotted.split(".");

	for(var i in split) {
		var quad = split[i];
		intip += Number(quad) * Math.pow(256, exp);
		exp--;
	}

	return intip;
}

String.prototype.autism = function () { // Autism.jpeg
  var parens = 0,
	    quotes = 0,
	    line = this.valueOf();
	for (var i = 0; i < line.length; i++) {
		if (line[i] === '(') { // Parens
			parens++;
		} else if (line[i] === ')') {
			parens--;
		}
		if (line[i] === '"') { // Quotes
			if (quotes % 2 === 0) { // Equal amount of quotes
				quotes++;
			} else { // Odd amount of quotes
				quotes--;
			}
		}
	}
	line = line + 
		Array(parens+1).join(')') +
		Array(quotes+1).join('"');
	return line;
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

var refresh = setInterval(function() {
	fs.writeFile('responses.txt', JSON.stringify(responses), function(fsErr) {
		if(fsErr) {
			throw fsErr;
		} else {
			console.log("Responses saved!");
			fs.writeFile('urls.txt', JSON.stringify(urls, null, "\t"), function(urlErr) {
				if(urlErr) {
					throw urlErr;
				} else {
					console.log("URLs saved");
					try {
						delete require.cache[require.resolve('./rc')];
						fs.writeFile('rc.js', "module.exports = " + JSON.stringify(rc, null, "\t"), function(fsErr2) {
							if(fsErr2) {
								throw fsErr2;
							} else {
								rc = require('./rc');
								console.log("Reloaded the configuration file");
							}
						});
					} catch(rcErr) {
						throw rcErr;
					}
				}
			});
		}
	});
}, 600000);

client.addListener('message#', function(nick, target, text, message) { // CAPS LOCK IS CRUISE CONTROL FOR COOL
	console.log(nick, target, text);
	
	if(typeof rc.chatmute[target] !== "undefined" || rc.chatmute[target] !== null) return;
	
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

/*client.addListener('message#', function(nick, target, text, message) { // AUTISM
	if(text !== text.autism()) {
		return client.say(target, "What " + nick + " meant to say was: `" + text.autism() + "`");
	}
});/**/

client.addListener('message#', function(nick, target, text, message) { // Normal functions
	if(typeof rc.functionmute[target] !== "undefined" || rc.functionmute[target] !== null) return;

	if(/^\.bots/.test(text)) { // Reporting in as a bot
		client.say(target, "Reporting in!");
		return;
	}
	if(/^\.shorten/.test(text)) { // URL shortening with waa.ai
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
	if(/^\.gh/.test(text)) { // Shows a user's github repositories
		var user = text.split(" ")[1];
		if(typeof user === "undefined") {
			client.say(target, nick + ": Fuck you.")
			return;
		}
		request("https://api.github.com/users/" + user + "/repos", function(e,r,b) {
			var json = JSON.parse(b),
			    index, repo;
			if(typeof json.length === "undefined") {
				client.say(target, "User does not exist");
				console.log(json);
				return;
			}
			client.say(target, irc.colors.codes.light_gray + user + irc.colors.codes.reset + " has " + irc.colors.codes.light_red + json.length + irc.colors.codes.reset + " repos.");
			for(index = 0; index < json.length; index++) {
				repo = json[index];
				if(index < 3) {
					client.say(target, irc.colors.codes.light_magenta + repo.name + irc.colors.codes.reset + " " + " " + repo.description.trim() + " (" + irc.colors.codes.light_blue + ( repo.language !== null ? repo.language : "None" ) + irc.colors.codes.reset + ")");
				} else {
					client.say(target, "...and " + irc.colors.codes.light_red + (json.length - 3) + irc.colors.codes.reset + " more!");
					return;
				}
			}
		});
		return;
	}
	if(/^\.nyaa/.test(text)) { // Nyaa.eu searching
		var term = text.replace(/^\.nyaa/, '').replace(/ /gi, escape(escape(" ")));
		request("http://query.yahooapis.com/v1/public/yql?format=json&diagnostics=false&q=select%20*%20from%20feed%20where%20url%3D'http%3A%2F%2Fwww.nyaa.eu%2F%3Fpage%3Drss%26filter%3D1%26term%3D" + term + "'", function(e,r,b) {
			var json,
			    item;
			try {
				json = JSON.parse(b).query.results;
			} catch(e) {
				json = JSON.parse(b).error;
				client.say(target, "[" + irc.colors.codes.dark_red + "ERROR" + irc.colors.codes.reset + "] " + json.description);
				return;
			}
			if(json === null) {
				client.say(target, nick + ": No items found.");
				return;
			}
			for(var i = 0; i < json.item.length; i++) {
				item = json.item[i];
				if(i < 4) {
					client.say(target, irc.colors.codes.light_red + item.category + irc.colors.codes.reset + " " + item.title + " [" + irc.colors.codes.light_green + item.description.split(" - ")[1].trim() + irc.colors.codes.reset + "] " + irc.colors.codes.light_blue + item.guid);
				} else {
					return;
				}
			}
		});
		return;
	}
	if(/^\.(?:btc|bitcoin(?:s?)|buttcoin(?:s?))/.test(text)) {
		request("https://btc-e.com/api/2/btc_usd/ticker", function(e, r, b) {
			var string;
			if(e) {
				return client.say(target, "ERROR: " + e);
			}
			try {
				JSON.parse(b);
			} catch(err) {
				return client.say(target, "ERROR: Error parsing response, probably not in JSON format.");
			}
			
			var buttcoins = JSON.parse(b)["ticker"];
			var colors = irc.colors.codes;
			string = format("%sHigh: %s$%s | %sLow: %s$%s | %sAverage: %s$%s", 
				colors.light_green, colors.reset, 
				buttcoins["high"], 
				colors.light_red, colors.reset, 
				buttcoins["low"], 
				colors.light_blue, colors.reset, 
				buttcoins["avg"]);
			client.say(target, string);
		});
		return;
	}
	if(/^\.(?:ltc|litecoin(?:s?)|kikecoin(?:s?))/.test(text)) {
		request("https://btc-e.com/api/2/ltc_usd/ticker", function(e, r, b) {
			var string;
			if(e) {
				return client.say(target, "ERROR: " + e);
			}
			try {
				JSON.parse(b);
			} catch(err) {
				return client.say(target, "ERROR: Error parsing response, probably not in JSON format.");
			}
			var kikecoins = JSON.parse(b)["ticker"];
			var colors = irc.colors.codes;
			string = format("%sHigh: %s$%s | %sLow: %s$%s | %sAverage: %s$%s", 
				colors.light_green, colors.reset, 
				kikecoins["high"], 
				colors.light_red, colors.reset, 
				kikecoins["low"], 
				colors.light_blue, colors.reset, 
				kikecoins["avg"]);
			client.say(target, string);
		});
		return;
	}
});

client.addListener('pm', function(nick, text) {
	if(!/^admin/i.test(text) || !rc.dcc) { 
		return;
	}
	var interfaces = os.networkInterfaces(); 
	var address;
	
	if(typeof interfaces['eth0'] !== 'undefined') { // Fuck everything
		address = interfaces['eth0'][0].address;
	} else {
		client.say(nick, 'Unable to find an IP address to bind to');
		return console.error('Unable to find a suitable IP address');
	}
	
	if(DCCPORT > DCCMAX) { // Our DCCPORT goes up everytime we make a server, so lets check if it went over the max our port number should be
		DCCPORT = 5555;
	}
	var server = net.createServer(function(stream) {
		stream.setEncoding('utf8');
		var times = 0;
		stream.on('connect', function() {
			console.log('stream connected');
			stream.write('welcome to the admin panel.\r\n');
			stream.write('Enter your password: \r\n');
		});
		stream.on('data', function(line) {
			if(times === 0) { // First line
				var hash1 = crypto.createHash('sha1'),
				    hash2 = crypto.createHash('sha1');
				if(hash1.update(line.trim()).digest('hex') === hash2.update(rc.passwd).digest('hex')) { 
					stream.write('Sucessfully logged in.\r\n');
				} else {
					stream.write('Error logging in. Closing socket.\r\n');
					stream.end();
					return;
				}
				times++;
				return;
			}
			var command = line.split(" ")[0]; 
			if(command === "say") {
				var chan = line.split(" ")[1];
				var re = new RegExp('^say \\' + chan.replace(/\//,'\/') + " "); // This is honestly the first time I've used 'new Object()' for something Javascript normally provides
				client.say(chan, line.replace(re, ''));
			} else if(command === "action") {
				var chan = line.split(" ")[1];
				var re = new RegExp('^action \\' + chan.replace(/\//,'\/') + " ");
				client.action(chan, line.replace(re, ''));
			} else if(command === "chans") {
				stream.write('Joined to: ' + Object.keys(client.chans).join(', ') + '\r\n');
			} else if(command === "mute") {
				var type = line.split(" ")[1].trim(),
				    mutechan = line.split(" ")[2].trim();
				
				type = ( type === "functions" ? "functionmute" : "chatmute" );
				
				rc[type].push(mutechan);
			} else if(command == "unmute") {
				var type = line.split(" ")[1];
				    unmutechan = line.split(" ")[2];
				
				type = ( type === "functions" ? "functionmute" : "chatmute" );
				
				if(rc[type].indexOf(unmutechan) === -1) return;
				
				delete rc[type][ rc[type].indexOf(unmutechan) ];
			} else if(command === "join") {
				client.join(line.replace(/^join /i, ''));
			} else if(command === "part") {
				try { // try {} catch() {} block: When you're too stupid to actually handle errors correctly
					client.part(line.replace(/^part /i, '').trim());
				} catch(e) {
					console.log(e);
				}
			} else if(command === "announce") {
				var message = line.replace(/^announce /,'');
				Object.keys(client.chans).forEach(function(channel) {
					client.say(channel, message.trim() + ' [' + nick + ']');
				});
			} else if(command === "help") {
				stream.write('say - Says something on a channel\n' +
				            'action - Does an action on a channel\n' +
				            'chans - Lists channels the bot is on\n' +
				            'mute - Mutes non-command output for a channel\n' +
				            'unmute - Unmutes non-command output for a channel\n' +
				            'join - Joins a channel\n' + 
				            'part - Parts a channel\n' +
				            'announce - Says something to every channel ' + rc.nick + ' is on\n' +
				            'exit - Exits the chat\n');
			} else if(command === "exit") {
				stream.write('Bye\n');
				stream.end();
			}
		});
		stream.on('error', function(err) {
			if(err) console.error(err);
		});
		stream.on('end', function() {
			console.log('stream closed');
		});
	});
	server.maxConnections = 1;
	server.listen(DCCPORT); // Listen

	client.ctcp(nick, 'privmsg', 'DCC CHAT CHAT ' + ip2int(address) + ' ' + DCCPORT); // Send the DCC CHAT request

	DCCPORT++;
});

client.addListener('error', function(err) {
	console.error(err);
});
(function() {
	if(!rc.git) return;

	app.configure(function() {
		app.use(express.bodyParser());
		app.use(express.logger());
	});

	app.post('/', function(req, res) {
		if( [
			"207.97.227.253",
			"50.57.128.197",
			"108.171.174.178",
			"50.57.231.61"
		].indexOf(req.connection.remoteAddress) === -1 || req.headers['X-Github-Event'] !== 'push') return;
		var payload = JSON.parse(req.body.payload);
		Object.keys(client.chans).forEach(function(channel) {
			client.say(channel, irc.colors.codes.light_gray + payload.repository.name + (typeof payload.repository.language === "undefined" ? "" : " (" + irc.colors.codes.light_blue + payload.repository.language + irc.colors.codes.reset + ")" ) + irc.colors.codes.reset + " had " + payload.commits.length + " commit" + ( payload.commits.length > 1 ? "s" : "" ) + " added.");
			payload.commits.forEach(function(commit) {
				client.say(channel, irc.colors.codes.light_magenta + "[" + commit.author.name + "]" + irc.colors.codes.reset + " " + commit.message.replace(/\n/gim, " ") + " " + irc.colors.codes.light_green + "[" + payload.ref.split('/')[payload.ref.split("/").length-1] + "]" + irc.colors.codes.reset + " " + irc.colors.codes.light_blue + commit.url);
			});
		});
	});

	app.listen(8181);
}).call(this);
