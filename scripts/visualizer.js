let editor = ace.edit("editor-text");
//themes are available here: https://github.com/ajaxorg/ace/tree/master/lib/ace/theme
editor.setTheme("ace/theme/tomorrow"); // editor lhs
editor.session.setMode("ace/mode/javascript");

var show = document.getElementById('show'); // visualiser rhs

window.addEventListener('resize', function(){
	show.showKnitout.requestDraw();
});

show.showKnitout.clickLine = function(source) {
	console.log("Jump to: " + source);
	let line = parseInt(source);
	editor.gotoLine(line);
};

editor.selection.addEventListener('changeCursor',function(){
	let cursor = editor.selection.getCursor();
	let range = editor.selection.getRange();
	const start = range.start.row + 1;
	const end = range.end.row + 1;
	show.showKnitout.setHighlightFn(function(source){
		let line = parseInt(source);
		if (line >= start && line <= end) {
			return true;
		} else {
			return false;
		}
	});
});


let oldHoveredRow = NaN;

show.showKnitout.onHoverSource = function(source) {
	if (oldHoveredRow === oldHoveredRow) {
		editor.session.removeGutterDecoration(oldHoveredRow-1, "knitoutBox");
	}
	let line = parseInt(source);
	line = line-2; // compensate for offset
	oldHoveredRow = line;
	editor.session.addGutterDecoration(oldHoveredRow-1, "knitoutBox");
};

show.showKnitout.onDoubleClickSource = function(source) {
	//console.log("onDoubleClick '" + source + "'"); //DEBUG
	let line = parseInt(source);
	line = line-2; // compensate for offset
	editor.scrollToLine(line-1, true, true, () => {});
};

document.getElementById("resetZoom").onclick = function (evt) {
	show.showKnitout.resetZoom();
}

let knitout;
 const code = document.getElementById("code1");
 const codeWrapper = document.getElementById("codeWrapper");
 const knitoutCheckbox = document.getElementById("showKnitout");
 const wasteCheckbox = document.getElementById("wasteCheckbox");


async function updateVisualizer(centerView) {
	updateKnitoutMode();

	let code = editor.getValue();

	if (code.indexOf("\r\n") !== -1) {
		console.log("Converting dos line endings to unix-style (as required by knitout spec).");
		code = code.replaceAll("\r\n", "\n");
	}

	if (isKnitout()) {
		//mark up code with line numbers:
		knitout = '';
		code.split('\n').forEach(function(line, lineNumber){
			knitout += line;
			if (line.indexOf(';') === -1) {
				knitout += ';!source:' + (lineNumber+1);
			}
			knitout += '\n';
		});
	} else {
		knitout = await evalJS(code);
	}
	//console.log(knitout);
	show.showKnitout.parse(knitout, false, centerView);
}

//Timing code:
if (false) {
	function TimingMachine() {
		this.count = 0;
		this.ignored = 0;
	}
	function countOp() { this.count += 1; }
	function ignoreOp() { this.ignored += 1; }
	["in","out","inhook","releasehook","outhook","stitch","rack","pause","x-stitch-number"].forEach(function(op) {
		TimingMachine.prototype[op] = ignoreOp;
	});
	["knit","tuck","split","miss"].forEach(function(op) {
		TimingMachine.prototype[op] = countOp;
	});
	TimingMachine.prototype.setCarriers = function() { }
	TimingMachine.prototype.stretchLoops = function() { }

	const oldUpdateVisualizer = updateVisualizer;
	updateVisualizer = async function timeUpdateVisualizer(centerView) {
		const TIMING_ITERS = 100;

		//time code generation:
		let codeParse = {
			min:Infinity,
			total:0.0,
			boxInstructions:NaN,
			otherInstructions:NaN
		};
		(async () => {
			for (let iter = 0; iter < TIMING_ITERS; ++iter) {
				let before = performance.now();
				updateKnitoutMode();

				let code = editor.getValue();
				if (isKnitout()) {
					//mark up code with line numbers:
					knitout = '';
					code.split('\n').forEach(function(line, lineNumber){
						knitout += line;
						if (line.indexOf(';') === -1) {
							knitout += ';!source:' + (lineNumber+1);
						}
						knitout += '\n';
					});
				} else {
					knitout = await evalJS(code);
				}

				const tm = new TimingMachine();
				parseKnitout(knitout, tm, false);
				let after = performance.now();
				codeParse.min = Math.min(codeParse.min, after - before);
				codeParse.total += (after - before);
				if (codeParse.boxInstructions === codeParse.boxInstructions) {
					console.assert(tm.count === codeParse.boxInstructions);
					console.assert(tm.ignored === codeParse.otherInstructions);
				}
				codeParse.boxInstructions = tm.count;
				codeParse.otherInstructions = tm.ignored;
			}
		})();

		//time visualization overall:
		(() => {
			let min = Infinity;
			let total = 0.0;
			for (let iter = 0; iter < TIMING_ITERS; ++iter) {
				let before = performance.now();
				oldUpdateVisualizer(centerView);
				let after = performance.now();
				min = Math.min(min, after - before);
				total += (after - before);
			}
			console.log("Had " + codeParse.boxInstructions + " box-generating instructions and " + codeParse.otherInstructions + " other instructions; user code + parse took " + codeParse.min + " ms min / " + codeParse.total / TIMING_ITERS + " ms avg over " + TIMING_ITERS + " runs.");
			console.log("Update took " + min + " ms min, " + (total / TIMING_ITERS) + " ms avg over " + TIMING_ITERS + " iterations.");
			console.log(" User/source: " + codeParse.min + " ms min ; vis: " + (min - codeParse.min) + " ms min; vis/ins: " + (min - codeParse.min) / codeParse.boxInstructions + " ms / instruction min.");
			//codeParse.total / TIMING_ITERS + " ms avg over " + TIMING_ITERS + " runs.");
			//console.log("Update took " + min + " ms min, " + (total / TIMING_ITERS) + " ms avg over " + TIMING_ITERS + " iterations.");
		})();
	};
}


updateVisualizer(true);

let compile = document.getElementById("compile");
compile.addEventListener('click', function() { updateVisualizer(false); } );

// let reload = document.getElementById("reload");
// let currentSource = null; //{file:file} or {url:url} or null
// reload.addEventListener('click', function() {
// 	if (currentSource) {
// 		if (currentSource.file) {
// 			readFile(currentSource.file);
// 		} else if (currentSource.url) {
// 			readURL(currentSource.url);
// 		}
// 	}
// });

var file = document.getElementById("file");
let currentSource = null; //{file:file} or {url:url} or null
file.addEventListener('change', function(evt){
	console.log('getting file')
	try {
		readFile(file.files[0]);
		file.value = "";
	} catch (e) {
		console.log(e);
	}
	evt.preventDefault();
	return false;
});



function setSource(source, text) {
	const sameFile = JSON.stringify(currentSource) === JSON.stringify(currentSource);
	currentSource = source;
	const name = (source.file ? source.file.name : source.url);
	document.getElementById('fileName').innerText = name;
	console.log("read " + name);
	let oldText = text;
	/*
	//line ending conversion:
	text = text.replace(/\r\n/g,"\n");
	if (oldText != text) {
		console.warn("Converted dos-style line endings to unix-style.")
	}
	*/
	editor.setValue(text, -1);
	updateVisualizer(!sameFile);
}

function readURL(url) {
	console.log("Attempting to read url: '" + url + "'");
	let request = new XMLHttpRequest();
	request.addEventListener('load', () => {
		setSource({url:url}, request.responseText);
	});
	request.open('GET', url);
	request.send();
}


function readFile(file) {
	console.log("Attempting to read file: '" + file.name + "'");

	//generate new data:
	var reader = new FileReader();
	reader.onload = () => {
		setSource({file:file}, reader.result);
	};
	console.log("reading " + file.name);
	reader.readAsText(file);
}

function isKnitout() {
	const line = editor.getSession().getLine(0);
	return /^;!knitout-\d+/.test(line);
}

function updateKnitoutMode() {
	if (isKnitout()) {
		//knitout!
		editor.getSession().setMode("ace/mode/plain_text");
	} else {
		//javascript!
		editor.getSession().setMode("ace/mode/javascript");
	}
}

editor.getSession().on('change', updateKnitoutMode);

async function saveKCode() {
	updateKnitoutMode();

	let code = editor.getValue();

	if (code.indexOf("\r\n") !== -1) {
		console.log("Converting dos line endings to unix-style (as required by knitout spec).");
		code = code.replaceAll("\r\n", "\n");
	}

	if (isKnitout()) {
		//mark up code with line numbers:
		knitout = '';
		code.split('\n').forEach(function(line, lineNumber){
			knitout += line;
			if (line.indexOf(';') === -1) {
				knitout += ';!source:' + (lineNumber+1);
			}
			knitout += '\n';
		});
	} else {
		knitout = await evalJS(code);
	}

	if (wasteCheckbox.checked) {
		knitout = addWasteSection(knitout);
	}

	convertKnitout(knitout);
}

function convertKnitout(text) {
	filename="kcode-file.k"
	//automatically add console logs to messages innerHTML
	const real = {
		log:console.log,
		info:console.info,
		warn:console.warn,
		error:console.error,
		assert:console.assert
	}

	console.assert = function () {
		if (arguments[0]) {
			//don't print anything, condition was true.
		} else {
			// [...arguments] converts to array so we can slice off the first (condition) argument:
			console.log(...[...arguments].slice(1));
		}
		real.assert(...arguments); //also log to console
	};
	try {
		//determine output filename:
		let kcFile;
		let i = filename.lastIndexOf('.');
		if (i === -1) kcFile = filename + '.kc';
		else kcFile = filename.substr(0,i) + '.kc';

		//create kcode:
		const {headers, passes} = knitoutToPasses(text, filename);
		const kcode = passesToKCode(headers, passes, kcFile);

		// setOutFile(kcFile, kcode);
		console.info(`... done processing '${filename}'.`);
		fileSave(kcode, "kcodeFile.kc");

	} catch (e) {
		// setOutFileError();
		console.error(e);
	}

	for (const name of ['log', 'info', 'warn', 'error']) {
		console[name] = real[name];
	}
}

 function toggleKnitout() {
	if (knitoutCheckbox.checked) {
		codeWrapper.style.display = '';
	} else {
		codeWrapper.style.display = 'none';
	}
 }
 toggleKnitout();

async function toggleWaste() {
	updateKnitoutMode();

	let code = editor.getValue();

	if (code.indexOf("\r\n") !== -1) {
		console.log("Converting dos line endings to unix-style (as required by knitout spec).");
		code = code.replaceAll("\r\n", "\n");
	}

	if (isKnitout()) {
		//mark up code with line numbers:
		knitout = '';
		code.split('\n').forEach(function(line, lineNumber){
			knitout += line;
			if (line.indexOf(';') === -1) {
				knitout += ';!source:' + (lineNumber+1);
			}
			knitout += '\n';
		});
	} else {
		knitout = await evalJS(code);
	}

	if (wasteCheckbox.checked) {
		knitout = addWasteSection(knitout);
		show.showKnitout.parse(knitout, false, true);

	} else {
		show.showKnitout.parse(knitout, false, true);
	}
 }

function saveKnitout() {
	// Remove source line comments
	let commentFreeKnitout = "";
	let lines = knitout.split("\n");
	for (let i = 0; i < lines.length; ++i) {
	let sourceCommentIndex = lines[i].indexOf(";!source:");
	if (sourceCommentIndex >= 0) {
		lines[i] = lines[i].substring(0, sourceCommentIndex);
	}
	commentFreeKnitout += lines[i] + "\n";

	}
	fileSave(commentFreeKnitout, "knitoutFile.k");
}

function saveJavascript(){
	fileSave(editor.getValue(), "knitoutFile.js");
}

function fileSave(sourceText, fileIdentity) {
	var workElement = document.createElement("a");
	if ('download' in workElement) {
		workElement.href = "data:" + 'text/plain' + "charset=utf-8," + escape(sourceText);
		workElement.setAttribute("download", fileIdentity);
		document.body.appendChild(workElement);
		var eventMouse = document.createEvent("MouseEvents");
		eventMouse.initMouseEvent("click", true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		workElement.dispatchEvent(eventMouse);
		document.body.removeChild(workElement);
	} else throw 'File saving not supported for this browser';
}


{ //check for '?load=....' in the URL:
	const m = document.location.search.match(/^\?load=(.+)$/);
	if (m) {
		readURL(m[1]);
	}
}
