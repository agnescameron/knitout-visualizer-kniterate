//------------------------------------
let lines = [];

// add menu for selecting these
// these are the kniterate settings
let defaultRollerAdvance = 450, defaultStitchNumber = 5, defaultSpeedNumber = 250;
let defaultWasteCarrier = '6', defaultDrawCarrier = '1', defaultCastonCarrier = '2';
let defaultCastonStyle = 2; castonCarrier = 3;// open tube

let rollerAdvance, stitchNumber, speedNumber;
let wasteCarrier, drawCarrier;
let castonStyle;
const wastePasses = 51;
const tubeRows = 5;

let minN, maxN, wasteMin, wasteMax;

class WasteSection {
	constructor(carrierSet) {
		this.carrierSet = carrierSet;
		this.lines = [];
	}

	push(line, id) {
	this.lines.push(line);
	if (id) {
		const info = line.trim().split(' ');
		const dir = info[1];
		if (dir === '+' || dir === '-') {
			this.carrierSet.setPosition(id, dir === '+' ? 'R' : 'L');
			}
		}
	}
}

class CarrierSet {
	// position is always L at the start
	constructor(carriers) {
		this.carriers = carriers.map(c => ({ 
			position: "L", castOn: false, ...c }));
	}

	// roles -- need to know cast-on drawthread etc.
	// if there are duplicates here, need to change mode
	get castOn()     { return this.carriers.find(c => c.castOn);}
	get drawThread() { return this.carriers.find(c => c.role === "drawThread");}
	get waste()      { return this.carriers.find(c => c.role === "waste");}
	get mainYarns()  { return this.carriers.filter(c => c.isMainYarn);}

	// lookup
	get(id) { return this.carriers.find(c => c.id === id); }

	// set the position (happens every row)
	setPosition(id, side) {
		const carrier = this.carriers.find(c => c.id === id);
		if (!carrier) throw new Error(`Carrier ${id} not found`);
		carrier.position = side;
	}

	// set the direction they get introduced
	setDir(id, dir) {
		const carrier = this.carriers.find(c => c.id === id);
		if (!carrier) throw new Error(`Carrier ${id} not found`);
		carrier.dir = dir;
	}

	// change a carrier's role
	setRole(id, role) {
		const carrier = this.carriers.find(c => c.id === id);
		if (!carrier) throw new Error(`Carrier ${id} not found`);
		carrier.role = role;
	}

	// add a carrier to the carrier set
	push(carrier) {
	if (this.carriers.some(c => c.id === carrier.id)) {
		throw new Error(`Carrier ${carrier.id} already exists`);
	}
		this.carriers.push({ position: "L", ...carrier });
	}
}

function removeComment(str) {
	if (str.includes(';')) return str.slice(0, str.indexOf(';'));
	else return str;
}

function getHeaders (file){
	if (lines.length > 0) {
		headers = lines.splice(0, lines.findIndex(ln => ln.split(' ')[0] === 'in'));
	} 

	else {
		headers = [
			';!knitout-2', 
			`;;Machine: Kniterate`, 
			`;;Carriers: 1 2 3 4 5 6`
		];
	}

	return headers;
}

function findMinMax (lines) {
	//the part of the code that finds the min and max needle
	if (lines.length > 0) {
		let needles = new Set();

		for (let i = 0; i < lines.length; ++i) {
			let info = lines[i].trim().split(' ');
			if (info[0].charAt(0) !== ';' && info.length > 1) {
				if(info[0] === "knit"){
					let needle = Number(removeComment(info[2].slice(1)));
					needles.add(needle);
				}

				else if(info[0] === "xfer"){
					let needle = Number(removeComment(info[2].slice(1)));
					needles.add(needle);
				}
			}

		}

		const needleArr = Array.from(needles);
		let minVal = Math.min(...needleArr);
		let maxVal = Math.max(...needleArr);

		width = maxVal - minVal + 1;
		
		if (width < 20) {
			minN >= (20 - width) ? ((wasteMin = minVal - (20 - width)), (wasteMax = maxVal)) 
				: ((wasteMin = minVal), (wasteMax = maxVal + (20-width)));
		} else {
			wasteMin = minVal;
			wasteMax = maxVal;
		}


		return [minVal, maxVal, wasteMin, wasteMax]
	}

	else return [0,0]
}


function parseMainYarns(lines) {
	const carriers = new CarrierSet([]);
	if (lines.length > 0) {
		const castOnId = lines[0].split(' ')[1].charAt(0);
		carriers.push({ id: castOnId, role: null, castOn: true, isMainYarn: true });
		// lines.shift();

		lines.forEach((ln, idx) => {
			const info = removeComment(ln).trim().split(' ');

			// Carrier introduced with 'in' command
			if (info[0] === 'in' && info.length > 1) {
				console.log(info);
				const id = info[1].charAt(0);
				if (!carriers.get(id)) {
					carriers.push({ id, role: null, castOn: false, isMainYarn: true });
					lines.splice(idx, 1); // remove the line where carrier is 'in'
				}
			}

			// First stitch for this carrier — capture direction
			if (info.length > 2 && !info[0].includes(';')) {
				const id = info[info.length - 1];
				const carrier = carriers.get(id);
				if (carrier && !carrier.dir) {
					carriers.setDir(id, info[1]); // "+" or "-"
				}
			}
	  });
	}
	return carriers;
}


function generateTransfers(carrierSet) {
	let xfers = [];

	// transfers R->L, ending up at L
	if (carrierSet.castOn.dir === "+"){
		for (let n = minN; n <= maxN; ++n) {
			xfers.push("xfer b" + n + " f"+n);
		}
	}

	// transfers L->R, ending up at R
	else {
		for (let n = maxN; n >= minN; --n) {
			xfers.push("xfer b" + n + " f"+n);
		}
	}

	return xfers;

}


function generateWasteSection(carrierSet, toDrop) {
	let wasteSection = new WasteSection(carrierSet);

	// INITIALISE
	// initialise the yarns with a tuck
	wasteSection.push(`;initialize yarns`);

	carrierSet.carriers.forEach( (carrier, i) => {
		wasteSection.push(`in ${carrier.id}`);
		let bed = 'f';

		// tuck each carrier in turn
		for (let n = wasteMin; n <= wasteMax; ++n) {
			const bed = (Math.abs(n) + i) % 2 === 0 ? 'f' : 'b';
			if (Math.abs(n) % carrierSet.carriers.length === i) {
				wasteSection.push(`tuck + ${bed}${n} ${carrier.id}`, carrier.id);
			} else if (n === wasteMax) {
				wasteSection.push(`miss + ${bed}${n} ${carrier.id}`, carrier.id);
			}
		}

		for (let n = wasteMax; n >= wasteMin; --n) {
			const bed = (Math.abs(n) + i) % 2 === 0 ? 'b' : 'f' ;
			if (Math.abs(n) % carrierSet.carriers.length === i) {
				wasteSection.push(`tuck - ${bed}${n} ${carrier.id}`, carrier.id);
			} else if (n === wasteMin) {
				wasteSection.push(`miss - ${bed}${n} ${carrier.id}`, carrier.id);
			}
		}
	})

	// WASTE YARN INTERLOCK
	// knit wastePasses rows of the waste yarn. carrier ends
	// wastePasses should always be odd in Mode A
	wasteSection.push(`;waste yarn section`);
	for (let p = 0; p < wastePasses; ++p) {

		// even numbered rows in +ve direction
		if (p % 2 === 0) {
			for (let n = wasteMin; n <= wasteMax; ++n) {
				if (n % 2 === 0) {
					wasteSection.push(`knit + f${n} ${wasteCarrier}`, wasteCarrier);
				} else {
					wasteSection.push(`knit + b${n} ${wasteCarrier}`, wasteCarrier);
				}
			}
		} 

		// odd numbered rows in -ve direction
		else {
			for (let n = wasteMax; n >= wasteMin; --n) {
				if (n % 2 === 0) {
					wasteSection.push(`knit - b${n} ${wasteCarrier}`, wasteCarrier);
				} else {
					wasteSection.push(`knit - f${n} ${wasteCarrier}`, wasteCarrier);
				}
			}
		}
	}

	// BRING IN DRAW THREAD
	// knit 1 row of draw thread, from L to R
	for (let n = wasteMin; n <= wasteMax; ++n) {
		if (n % 2 === 0) {
			wasteSection.push(`knit + b${n} ${drawCarrier}`, drawCarrier);
		} else {
			wasteSection.push(`knit + f${n} ${drawCarrier}`, drawCarrier);
		}
	}

	// BRING IN EACH MAIN YARN
	// knit one or two depending on direction
	// cast on direction needs to be opposite
	// need to keep track of rows from here
	let rowCount = 0;
	console.log("main yarns are", carrierSet.mainYarns);

	carrierSet.mainYarns.forEach(carrier => 
		{
			rows = 2; // default

			if (carrier.castOn && carrier.dir === '+') rows = 1;
			if (!carrier.castOn && carrier.dir === '-') rows = 1;

			// always do 1 row
			for(i=0; i<rows; i++) {
				if (rowCount % 2 === 0) {
					for (let n = wasteMin; n <= wasteMax; ++n) {
						if (n % 2 === 0) {
							wasteSection.push(`knit + f${n} ${carrier.id}`, carrier.id);
						} else {
							wasteSection.push(`knit + b${n} ${carrier.id}`, carrier.id);
						}
					}
				} 
				// odd numbered rows in -ve direction
				else {
					for (let n = wasteMax; n >= wasteMin; --n) {
						if (n % 2 === 0) {
							wasteSection.push(`knit - b${n} ${carrier.id}`, carrier.id);
						} else {
							wasteSection.push(`knit - f${n} ${carrier.id}`, carrier.id);
						}
					}
				}

				rowCount += 1;
			}
		})


	// TUBE
	// needs to drop out on LHS
	for (let p = 0; p < tubeRows; ++p) {
		if(p % 2 === 0){
			for (let n = wasteMax; n >= wasteMin; --n) {
				wasteSection.push(`knit - b${n} ${wasteCarrier}`, wasteCarrier);
			}
		} else {
			for (let n = wasteMin; n <= wasteMax; ++n) {
				wasteSection.push(`knit + f${n} ${wasteCarrier}`, wasteCarrier);
			}
		}
	}

	// drop any extra needles if width < 20
	if (toDrop.length) {
		for (let n = 0; n < toDrop.length; ++n) {
			wasteSection.push(`drop f${toDrop[n]}`);
		}
	}

	// drop all needles on back bed
	for (let n = wasteMin; n <= wasteMax; ++n) {
		wasteSection.push(`drop b${n}`);
	}

	// draw thread -- always R-L
	wasteSection.push(`;draw thread`);
	for (let n = maxN; n >= minN; --n) {
		wasteSection.push(`knit - f${n} ${drawCarrier}`);
	}

	// cast on both beds (final step)
	if (carrierSet.castOn.dir === '-') {
		wasteSection.push('rack 0.5');
		for (let n = minN; n <= maxN; ++n) {
			wasteSection.push(`knit + f${n} ${carrierSet.castOn.id}`, carrierSet.castOn.id);
			wasteSection.push(`knit + b${n} ${carrierSet.castOn.id}`, carrierSet.castOn.id);
		}
	} 

	else {
		wasteSection.push('rack -0.5');
		for (let n = maxN; n >= minN; --n) {
			wasteSection.push(`knit - f${n} ${carrierSet.castOn.id}`, carrierSet.castOn.id);
			wasteSection.push(`knit - b${n} ${carrierSet.castOn.id}`, carrierSet.castOn.id);
		}
	}

	wasteSection.push(`rack 0`);

	return wasteSection.lines;
}

function addWasteSection (file) {
	rollerAdvance = defaultRollerAdvance;
	stitchNumber = defaultStitchNumber;
	speedNumber = defaultSpeedNumber;
	wasteCarrier = defaultWasteCarrier;
	drawCarrier = defaultDrawCarrier;
	castonStyle = defaultCastonStyle;


	let lines = file.split('\n');
	let mode = "A" // normal mode

	// convert inhook to in commands
	try {
		lines.forEach(line => {
			if (line.includes("inhook") || line.includes("releasehook") || line.includes("outhook")){
				throw new Error("commands 'inhook', 'outhook' and 'releasehook' not valid for kniterate");
				return;
				}
			})
		}
		catch(e) {
			window.alert(e);
		}

	// file setup
	const prefix = [
			`x-roller-advance ${rollerAdvance}`, 
			`x-stitch-number ${stitchNumber}`, 
			`x-speed-number ${speedNumber}`
	];

	let headers = [];
	if (file) {
		headers = lines.splice(0, lines.findIndex(ln => ln.split(' ')[0] === 'in'));
	} else {
		headers = [
			';!knitout-2', 
			`;;Machine: Kniterate`, 
			`;;Carriers: 1 2 3 4 5 6`
		];
	}

	// get the width of the sample
	[minN, maxN, wasteMin, wasteMax] = findMinMax(lines);


	// check if you need to drop any waste section
	let toDrop = [];
	for (let n = wasteMin; n <= wasteMax; ++n) {
		if (n < minN || n > maxN) toDrop.push(n);
	}

	// get in carriers and caston carrier
	let carrierSet = parseMainYarns(lines);
	
	// now add in drawthread and waste yarn

	// check waste carrier is not in main yarns
	// don't want waste last as subtle bug if it's the first one tucked
	if(carrierSet.carriers.some(c => c.id === wasteCarrier)){
		window.alert(`main carriers can't be the same as waste yarn (${wasteCarrier})`)
		// right now draw and waste can't match- 
		//but could set a check for this in future
		carrierSet.setRole(wasteCarrier, "waste");

		mode = "B"; // waste thread included in main yarns
	}
	else {
		carrierSet.push({ 
			id: wasteCarrier, 
			role: "waste", 
			isMainYarn: false, 
			dir: "+"
		})
	}

	// check draw thread not in main yarns
	if(carrierSet.carriers.some(c => c.id === drawCarrier)){
		window.alert(`main carriers can't be the same as draw thread (${drawCarrier})`)
		carrierSet.setRole(drawCarrier, "draw");
		if (mode === "B") mode = "D" // both
		else mode = "C" // draw thread included in main yarns
	}

	else {
		carrierSet.push({ 
			id: drawCarrier, 
			role: "drawThread", 
			isMainYarn: false, 
			dir: "+"
		})
	}

	const waste = generateWasteSection(carrierSet, toDrop);
	const xfers = generateTransfers(carrierSet);

	lines = [...headers, ...waste, ...xfers, ...lines];
	output = lines.join('\n');

	return output;
}