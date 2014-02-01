var express = require('express'),
	app = express(),
	path = require('path'),
	fs = require('fs'),
	rmdir = require('rimraf'),
	crypto = require('crypto'),
	spawn = require('child_process').spawn;

app.set('port', process.env.PORT || 3000);
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
	res.sendfile('public/index.html');
});

var io = require('socket.io').listen(app.listen(app.get('port')));
console.log('Listening on port ' + app.get('port'));

var positionList = [];
var waitForNum = 0;

io.sockets.on('connection', function(socket) {
	positionList.push(null);

	// Send client their id
	socket.emit('id', socket.id);

	// Update positions
	io.sockets.emit('updatepositions', positionList);

	// Set the clients position emit updated positions to all other clients
	socket.on('position',  function(data) {
		// Remove it from a position it previously held
		var curPos = positionList.indexOf(socket.id);
		if (curPos > -1) { positionList[curPos] = null; }

		positionList[data] = socket.id;

		// Once a client has chosen a position they can now take pictures
		socket.join('ready');

		io.sockets.emit('updatepositions', positionList);
	});

	// Every client that is ready takes a picture
	socket.on('shutter', function(data){
		waitForNum = io.sockets.clients('ready').length;
		
		crypto.randomBytes(4, function(ex, buf) {
			var randID = buf.toString('hex');

			fs.mkdir('./tmp/' + randID, function() {
				io.sockets.in('ready').emit('takepicture', {randid: randID});
			});
		});
	});

	socket.on('image', function(data) {
		// Receive the image
		var pad = '00';
		var pos = '' + positionList.indexOf(socket.id) + 1;
		var padPos = pad.substring(0, pad.length - pos.length) + pos;

		var base64Data = data.imgdata.replace(/^data:image\/png;base64,/,'');

		var randID = data.randid;

		console.log('Writing image #' + pos);
		fs.writeFile('./tmp/' + randID + '/' + padPos + '.png', base64Data, 'base64', function(err) {
			if (err) {
				console.log('Error writing image ' + pos + ': ' + err);
			} else {
				waitForNum--;
				if (waitForNum === 0) {
					makeGif(randID, function(gifID) {
						io.sockets.in('ready').emit('gifready', {gifid: gifID});
					});
				}
			}
		});
	});

	// Remove the client from the position list
	socket.on('disconnect', function() {
		var index = positionList.indexOf(socket.id);
		
		if (index > -1) {
			index = positionList.lastIndexOf(null);
		} 

		positionList.splice(index, 1);

		io.sockets.emit('updatepositions', positionList);
	});
});

// Call imagemagick command and and delete
function makeGif(randID, callback) {
	var gifOptions = [
		'-delay', '1x5',
		'./tmp/' + randID + '/*.png',
		'-coalesce', 
		'-layers', 'OptimizeTransparency',
		'./public/gifs/' + randID + '.gif'
	];

	var convertGif = spawn('convert', gifOptions);

	convertGif.on('exit', function(code, signal) {
		console.log('GIF ' + randID + '.gif made!');
		rmdir('./tmp/' + randID, function(err) {
			console.log(randID + ' folder removed!');
			callback(randID);
		});
	});
}