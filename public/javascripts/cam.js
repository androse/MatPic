(function() {
	var streaming = false, 
		viewfinder = document.querySelector('#viewfinder'),
		canvas = document.querySelector('#canvas'),
		preview = document.querySelector('#preview'),
		shutter = document.querySelector('#shutter'),
		width = 320,
		height = 0,
		cameraSource = null,
		vidStream = null;

	// Get video from webcam in different browsers
	navigator.getMedia = (
		navigator.getUserMedia ||
		navigator.webkitGetUserMedia ||
		navigator.mozGetUSerMedia ||
		navigator.msGetUserMedia
	);

	// Connect via socket.io
	var socket = io.connect('/');
	var sockid;

	// Send image data to the server
	function sendImage(randID, imgData) {
		socket.emit('image', {
			randid: randID,
			imgdata: imgData
		});
	}

	// Capture the canvas element to take a picture
	function takePicture(randID, callback) {
		canvas.width = width;
		canvas.height = height;
		canvas.getContext('2d').drawImage(viewfinder, 0, 0, width, height);

		var imgData = canvas.toDataURL('image/png');
		callback(randID, imgData);
	}

	// List the available video sources on the devices
	function gotSources(sourceInfo) {
		var active = '';
		var vidNum = 0;

		console.log('camera source: ' + cameraSource);
		$('#sources').empty();

		sourceInfo.forEach(function(element, index, array) {
			if (element.kind === 'video') {
				console.log('ID: ' + element.id);
				if (!cameraSource) {
					if (++vidNum === 1) {
						cameraSource = element.id;
						active = ' active';
					}
				} else {
					++vidNum;
					if (element.id === cameraSource) {active = ' active';}
					else {active = '';}
				}

				$('#sources').append($('<a>', {
					href: '#',
					id: element.id,
					class: 'list-group-item' + active
				}).text(element.label || 'Camera ' + vidNum));
			}
		});
	}

	// Check if browser is able to select different video sources 
	// Display message if not able to and list them if able
	function updateMediaStream() {
		if (typeof MediaStreamTrack === 'undefined') {
			$('#sources').parent().append($('<h3>')).text(
				'This browser does not allow you to select multiple video sources'
			);
		} else {
			MediaStreamTrack.getSources(gotSources);
		}
	}

	// Create the list of position buttons
	function createPositions(positionList) {
		$('.position-list').empty();

		positionList.forEach(function(element, index, array) {
			if (element === sockid) {
				$('.position-list').append($('<a>', {
					id: index, 
					class: 'position-item btn btn-primary'
				}).text(index + 1));
			} else if (element === null) {
				$('.position-list').append($('<a>', {
					id: index, 
					class: 'position-item btn btn-default'
				}).text(index + 1));
			} else {
				$('.position-list').append($('<a>', {
					id: index, 
					class: 'position-item btn btn-info'
				}).text(index + 1));
			}
		});
	}

	// getUserMedia success callbacks
	function successCallback(stream) {
		vidStream = stream;

		if (navigator.mozGetUSerMedia) {
			viewfinder.mozSrcObject = stream;
		} else {
			var vendorURL = window.URL || window.webkitURL;
			viewfinder.src = vendorURL.createObjectURL(stream);
		}

		viewfinder.play();
	}

	// getUserMedia error callback
	function errorCallback(err) { 
		console.log('There was an error! ' + err);
	}

	// start the selected video source in the video element
	function startVid() {
		if (vidStream) {
			viewfinder.src = null;
			vidStream.stop();
		}

		var constraints = {
			audio: false,
			video: {
		    	optional: [{sourceId: '' + cameraSource}]
		   	}
		}
		
		// Ask browser for video only and place stream in video element
		navigator.getMedia(constraints, successCallback, errorCallback);
	}

	// Called when page first loaded
	updateMediaStream();
	startVid();

	// Check the dimensions of the actual video when canplay is first fired and 
	// resize the video and canvas accordingly
	viewfinder.addEventListener('canplay', function(event) {
		if (!streaming) {
			height = viewfinder.videoHeight / (viewfinder.videoWidth/width)
			viewfinder.setAttribute('width', width);
			viewfinder.setAttribute('height', height);
			canvas.setAttribute('width', width);
			canvas.setAttribute('height', height);
			streaming = true;
		}
	}, false);

	// Socket io events

	// Receive the clients unique id
	socket.on('id', function(data) {
		sockid = data;
	});

	// Take a picture
	socket.on('takepicture', function(data) {
		takePicture(data.randid, sendImage);
	});

	// Update the positions of all devices
	socket.on('updatepositions', function(data) {
		createPositions(data);
	});

	// Display the gif when it's ready
	socket.on('gifready', function(data) {
		preview.setAttribute('src', 'gifs/' + data.gifid + '.gif');
	});

	// JQuery events

	// When video source is clicked
	$('#sources').on('click', '.list-group-item', function() {
		var selection = $(this).attr('id');

		cameraSource = selection;
		updateMediaStream();
		startVid();
	});

	// When shutter button is pressed
	$('#shutter').click(function() {
		socket.emit('shutter', {});
	});

	// When a position is selected
	$('.position-list').on('click', '.position-item', function() {
		var pos = parseInt($(this).attr('id'));

		socket.emit('position', pos);
	});
})();