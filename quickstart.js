var catched_headers = null;
var LastRequestId = 0;

//browser.runtime.onMessage.addListener(notify);
browser.runtime.onMessage.addListener(async (msg, sender) => {
	notify(msg);
});


console.log("HWQS page!");

var running_check = setInterval(checkHWRunningTimer, 2000);
var button_check = setInterval(CheckButtonStatus, 3000);

var quests_done = 0;
var quests_requested = 0;
var timer_do_quests = null;
var buttons_added = false;

var chestBuy_done = false;
var offerFarmReward_done = false;
var subscriptionFarm_done = false;
var zeppelinGiftFarm_done = false;

window.$ = function (selector) {
	var selectorType = 'querySelectorAll';

	if (selector.indexOf('#') === 0) {
		selectorType = 'getElementById';
		selector = selector.substr(1, selector.length);
	}

	return document[selectorType](selector);
};

function css(element_list, style, value) {
	try {
		if (!element_list) return;

		if (!element_list.length) {
			element_list.style[style] = value;
			return;
		}
		for (let paragraph of element_list) {
			paragraph.style[style] = value;
		}
	} catch { }
}

function make_green(p) {
	css(p, "background-color", "green");
	css(p, "color", "white");
}

function clear_green(p) {
	css(p, "background-color", "");
	css(p, "color", "");
}
function checkHWRunningTimer() {

	browser.runtime.sendMessage("ping");  // response are catched_headers from proxy (see notify)

	if (!buttons_added) {
		addFooterSpan("Something", "quick", btnClick);
		addFooterSpan("GetDailyQuests", "daily", btnClick);
		addFooterSpan("RaidOutland", "outland", btnClick);
		addFooterSpan("Tower", "tower", btnClick);
		addFooterSpan("Expeditions", "expeditions", btnClick);
		addFooterSpan("hwqsstatus", "...", function () { setStatus("..."); });

		buttons_added = true;
	}
}

var check_button = 0;
function CheckButtonStatus(checkthis = '') {
	check_button++;
	if (check_button > 6) check_button = 1;

	let id = "";
	let can_go = false;
	let checked = false;
	if (check_button == 1 || checkthis == "Something") {
		id = "Something";
	}
	if (check_button == 2 || checkthis == "GetDailyQuests") {
		id = "GetDailyQuests";
	}
	if (check_button == 3 || checkthis == "RaidOutland") {
		id = "RaidOutland";
		checked = true;
		can_go = RaidOutland(true);
	}
	if (check_button == 4 || checkthis == "Tower") {
		id = "Tower";
		checked = true;
		can_go = CheckTowerReady();
	}
	if (check_button == 4 || checkthis == "Expeditions") {
		id = "Expeditions";
		checked = true;
		can_go = CheckExpeditions();
	}

	if (id && id.length > 0) {
		let p = $("#" + id).parentNode;
		if (checked) {
			if (can_go)
				make_green(p);
			else
				clear_green(p);
		} else {
			if (buttons_added && catched_headers)
				make_green(p);
		}
	}
}

function setStatus(txt) {
	try {
		$("#hwqsstatus").innerText = txt;
	} catch { }
}

function btnClick(id) {
	if (id == "Something") {
		var done = "";
		
		if (!chestBuy_done)
			callAPI("chestBuy", "body", {"chest":"town","free":true,"pack":false}, 
				function(d) { 
					chestBuy_done = true; done += " chest "; setStatus(done + " done"); 
				} );

		if (!offerFarmReward_done)
			callAPI("offerFarmReward", "body", {"offerId": 127}, 
				function(d) { 
					offerFarmReward_done = true; 
					done += " skin "; setStatus(done + " done"); 
				} );
		
		if (!subscriptionFarm_done)
			callAPI("subscriptionFarm", "body", {}, 
				function(d) { 
					subscriptionFarm_done = true; 
					done += " subs "; setStatus(done + " done"); 
				});
				
		if (!zeppelinGiftFarm_done)
			callAPI("zeppelinGiftFarm", "zeppelinGiftFarm", {}, 
				function(d) { 
					zeppelinGiftFarm_done = true;
					done += " zeppelin "; setStatus(done + " done"); 
				} );
		
		if (SendGifts()) { done += " gift "; setStatus(done + " done"); }

		callAPI0("mailGetAll", function (result) {
			var lc = 0;
			for (let [key, letter] of Object.entries(result.letters)) {
				if (letter.read == "0") {
					callSync("mailFarm", {"letterIds":[ letter.id ]} );
					lc++;
				}
			};
			done += lc.toString() + " mails"; setStatus(done + " done");
		});
		callSync("ascensionChest_open", { "paid": false, "amount": 1 });
	}
	
	if (id == "GetDailyQuests") {
		quests_requested = 0;
		quests_done = 0;
		if (timer_do_quests) {
			clearInterval(timer_do_quests);
			timer_do_quests = null;
		}
		else
			timer_do_quests = setInterval(do_quests, 500);
	}
	
	if (id == "RaidOutland") {
		RaidOutland();
		CheckButtonStatus(id);
	}
	
	if (id == "Tower") {
		setTimeout(function () {
			FullTower();
			CheckButtonStatus(id);
		}, 100);
	}
	
	if (id == "Expeditions") {
		setTimeout(function () {
			StartNextExpeditions();
			CheckButtonStatus(id);
		}, 100);
	}
}

function do_quests() {
	
	setStatus(quests_done.toString() + " quests done");

	quests_requested++;
	if (quests_requested > 4) {
		clearInterval(timer_do_quests);
		timer_do_quests = null;
		return;
	}
	
	callAPI0("questGetAll", function (result) {

		for (let [key, quest] of Object.entries(result)) {
			if (quest.state == 2) {
				if (quest.progress > 0 && quest.reward.consumable)
				{
					callAPI("questFarm", "body", {"questId": quest.id}, function(d) { quests_done++; } );
				}
				if (quest.progress == 3 && quest.reward && !quest.reward.battlePassExp)
				{
					callAPI("questFarm", "body", {"questId": quest.id}, function(d) { quests_done++; } );
				}
				if (quest.progress > 0 && quest.reward && (quest.reward.coin || quest.reward.gold || quest.reward.stamina))
				{
					callAPI("questFarm", "body", {"questId": quest.id}, function(d) { quests_done++; } );
				}
			}
		};
	});
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChestNr() {
	return Math.floor(Math.random() * (2 - 0 + 1)) + 0;
}

function CheckTowerReady() {
	var info = GetTowerInfo();
	lastFloorNumber = info.lastFloorNumber;
	return lastFloorNumber <= 1;
}

function FullTower() {
	
	var retry = 0;
	var lastFloorNumber = 0;
	var last_chest_opened = false;

	while (lastFloorNumber <= 50 && retry < 60) {
		retry++;

		var info = GetTowerInfo();
		lastFloorNumber = info.lastFloorNumber;

		setStatus(`floor ${info.floorType} ${last_chest_opened ? 'top' : lastFloorNumber}`);

		if (info.floorType == "chest" && lastFloorNumber <= 50 && !last_chest_opened) {
			if (lastFloorNumber == 50) last_chest_opened = true;
			callSync("towerOpenChest", { num: randomChestNr() });
		}
		if ((info.floorType == "battle" || info.floorType != "chest") && lastFloorNumber < 50 && !last_chest_opened) {
			callSync("towerNextChest", {});
		}
		if ((info.floorType == "chest" && lastFloorNumber == 50 && last_chest_opened)
			// verpasst ?
			|| (retry == 1 && lastFloorNumber == 50 && info.floorType == "opened")
		) {
			setTimeout(function () {
				callSync("tower_farmPointRewards", { points: info.gold });
				setStatus(`tower done`);

				setTimeout(function () {
					callSync("tower_farmSkullReward", {});
					setStatus(`tower&skull done`);
				}, 1000);
			}, 1000);
			lastFloorNumber = 9999;
		}
	}
}

function GetTowerInfo() {
	var floorTypeInfo = "";
	var floorNumberInfo = 0;
	var point_arr = [];

	var result = callSync("towerGetInfo", {});
	try {
		floorNumberInfo = parseInt(result.floorNumber);
		floorTypeInfo = result.floorType;
		if (floorTypeInfo != "battle") {
			result.floor.chests.forEach((chest) => {
				if (chest.opened == 1)
					floorTypeInfo = "opened";
			});
		}
	} catch { }

	try {
		for (let [key, value] of Object.entries(result.pointRewards)) {
			if (value == false)
				point_arr.push(parseInt(key));
		}
	}
	catch { }

	return {
		lastFloorNumber: floorNumberInfo,
		floorType: floorTypeInfo,
		gold: point_arr,
	}
}

function GetReadyExpeditions(testonly = false) {
	exp_ready = false;
	if (!testonly)
		setStatus(`searching...`);
	var result = callSync("expeditionGet", {});
	try {
		var i = 0;
		for (let [key, item] of Object.entries(result)) {
			try {
				if (item.status && item.status == 2) {
					i++;
					if (item.endTime && new Date(item.endTime * 1000) < new Date()) {
						if (testonly)
							exp_ready = true;
                        else
							callSync("expeditionFarm", { "expeditionId": item.id });
					}
				}
			}
			catch
			{
			}

			try {
				for (let [kk, ii] of Object.entries(item)) {
					if (ii.status && ii.status == 2) {
						i++;
						if (ii.endTime && new Date(ii.endTime * 1000) < new Date()) {
							if (testonly)
								exp_ready = true;
							else
								callSync("expeditionFarm", { "expeditionId": ii.id });
						}
					}
				}
			}
			catch
			{
			}
		}
		if (!testonly)
			setStatus(`${i} expeditions ready`);
	}
	catch
	{
	}
	return exp_ready;
}

function CheckExpeditions() {
	if (GetReadyExpeditions(true)) return true;
	if (StartNextExpeditions(true)) return true;
	return false;
}

function StartNextExpeditions(testonly = false) {
	if (!testonly)	
		setStatus("searching for new expeditions...");

	var power_of_heroes = {};
	var heroes = [];
	var heroes_done = [];

	if (!testonly) {
		GetReadyExpeditions();

		var result_heroes = callSync("heroGetAll");
		try {
			for (let [hkey, item] of Object.entries(result_heroes)) {
				if (item.type == "hero") {
					heroes.push(item.id);
					power_of_heroes[item.id] = item.power;
				}
			}
		}
		catch { }
	}

	var result_exp = callSync("expeditionGet", {});
	var exps = [];
	try {
		for (let [key, item] of Object.entries(result_exp)) {
			try {
				var still_running = false;

				if (item.status && item.endTime && new Date(item.endTime * 1000) > new Date())
					still_running = true;

				if ((still_running || item.status && item.status != 2) && (item.heroes && item.heroes.length > 0)) {
					still_running = true;
					for (let [key, hero] of Object.entries(item.heroes)) {
						if (!heroes_done.includes(hero)) {
							heroes_done.push(hero);
						}
					}
				}
				if (!still_running && item.status && item.status == 1) {
					exps.push(item);
					continue;
				}
			}
			catch { }

			try {
				for (let [kk, ii] of Object.entries(item)) {
					var still_running = false;

					if (ii.status && ii.endTime && new Date(ii.endTime * 1000) > new Date())
						still_running = true;

					if ((still_running || ii.status && ii.status != 2) && (ii.heroes && ii.heroes.length > 0)) {
						still_running = true;
						for (let [key, hero] of Object.entries(ii.heroes)) {
							if (heroes.includes(hero)) {
								if (!heroes_done.includes(hero)) {
									heroes_done.push(hero);
								}
							}
						}
					}
					if (!still_running && ii.status && ii.status == 1) {
						exps.push(ii);
					}
				}
			}
			catch
			{
			}
		}

		if (testonly) {
			return exps.length > 0;
        }

		if (exps.length == 0) {
			setStatus("zero expeditions available");
			return;
		}

		setStatus(`${exps.length} expeditions found, calculating hero combinations`);

		var all_combos = [];
		for (let comb of G.clone.combination(heroes, 5)) {
			all_combos.push(comb);
		}

		var done = 0;

		for (let [key, item] of Object.entries(exps)) {
			if (item.status != 1) continue;

			var pwr = item.power;
			var my_heroes_power = 999999;
			var my_combo = null;

			for (const combo of all_combos) {

				var hero_active = false;
				for (const hero of combo) {
					if (heroes_done.includes(hero)) {
						var hero_active = true;
						break;
					}
				}
				if (hero_active) continue;

				var sum = combo.reduce((partialSum, a) => partialSum + power_of_heroes[a], 0);
				if (sum < pwr) continue;

				if (sum < my_heroes_power) {
					my_heroes_power = sum;
					my_combo = combo;
				}
			}

			if (my_combo) {
				done++;
				callSync("expeditionSendHeroes", { expeditionId: item.id, heroes: my_combo });
				setStatus(`started expedition ${done}/${exps.length}`);

				for (const hero of my_combo) {
					if (!heroes_done.includes(hero)) {
						heroes_done.push(hero);
					}
				}
			}
		}
		setStatus(`${done} open expeditions started`);

		all_combos = null;
	}
	catch (ex)
	{
		var stpp = ex;
	}
}

function RaidOutland(testonly=false) {

	var result = callSync("bossGetAll");
	try {
		var bosses = 0;
		var raids = 0;

		for (let [key, item] of Object.entries(result)) {
			bosses++;
			if (item.mayRaid == true) {
				raids++;
				if (!testonly) {
					callSync("bossRaid", { "bossId": item.id, "amount": 1, "starmoney": 0 });
					callSyncIdent("bossOpenChest", { "bossId": item.id, "amount": 1, "starmoney": 0 }, "group_1_body");
				}
			}
			if (!testonly)
				setStatus(`${raids}/${bosses} raids`);
		}
		return raids;
	}
	catch
	{
	}
	return 0;
}

function SendGifts() {
	result = callSync("clanGetAvailableDailyGifts");
	try {
		var found = false;
		for (let [key, item] of Object.entries(result)) {
			for (let [ky, ii] of Object.entries(item)) {
				found = true;
			}
		}
		if (found) {
			callSync("clanSendDailyGifts");
			//setStatus("gifts sent");
			return true;
		}
		else {
			//setStatus("no new gifts found");
		}
	}
	catch
	{
	}
	return false;
}

function AstralSeer(testonly = false) {
	//{"calls":[{"name":"ascensionChest_getInfo","args":{},"ident":"body"}]}
	//result
	//{"date":1665939058.793002,"results":[{"ident":"body","result":{"response":{"dailyGroups":["strength","mage"],"starmoneySpent":3000}}}]}
	//{"date":1665943349.335986,"results":[{"ident":"body","result":{"response":{"dailyGroups":["strength","mage"],"starmoneySpent":3000}}}]}


	callSync("ascensionChest_open", { "paid": false, "amount": 1 });

}

function callAPI0(std, success=null) {
	callAPI(std, "body", {}, function (data) {
		success(data);
	});
}

function callSync(std, args = {}) {
	var result = null;
	callAPI(std, "body", args = args, function (data) { result = data; }, false);
	return result;
}

function callSyncIdent(std, args = {}, ident) {
	var result = null;
	callAPI(std, ident, args = args, function (data) { result = data; }, false);
	return result;
}

function callAPI(std, ident=null, args={}, success=null, async=true) {
	
	var json_request = JSON.stringify(stdCall(std,args,ident));
	var headers = {};
	
	catched_headers.forEach((entry) => 
	{
		var v = entry.value;
		if (entry.name == "X-Request-Id") {
			v = (LastRequestId++).toString();
		}

		if (entry.name.startsWith("X-")) {
			headers[entry.name] = v;
		}

		if (entry.name != "X-Auth-Signature") {
			headers[entry.name] = v;
		}
	});
	
	headers["X-Auth-Signature"] = CheckSum(headers, json_request);

	var xhr = new XMLHttpRequest();
	xhr.open("POST", "https://heroes-wb.nextersglobal.com/api/", async);
	xhr.setRequestHeader('Content-Type', 'application/json; charset=utf-8');

	for (let [key, value] of Object.entries(headers)) {
		xhr.setRequestHeader(key, value);
	};

	xhr.onload = function () {
		try {
			if (xhr.status === 200) {
				let data = JSON.parse(xhr.responseText);
				if (data && data.error) {
					if (data && data.error.description)
						console.log("ERROR : " + data.error.description);
					else
						console.log("ERROR : " + data.error);
				}
				if (data.results && data.results.length && data.results[0].result)
					return success(data.results[0].result.response);
				else
					if (success) success(data);
			}
			else {
				alert('Request failed.  Returned status of ' + xhr.status);
			}
		} catch (ex) {
			console.log("EXCEPTION!");
			console.log(ex);
        }
	};
	xhr.send(json_request);
}

function stdCall(name, args, ident) {
	return { "calls": [{"name": name, "args": args, "ident": (ident == null ? name : ident)}]};
}

function CheckSum(headers, data) {
	var d = [headers["X-Request-Id"],
			 headers["X-Auth-Token"],
			 headers["X-Auth-Session-Id"],
			 data,
			 "LIBRARY-VERSION=1"].join(":");
	return MD5(d);
}

var colors_done = false;
function notify(message) {
	try {
		if (message.catched_headers != null) {
			catched_headers = message.catched_headers;
			LastRequestId = message.lastrequestid;
		}
		if (buttons_added && catched_headers && !colors_done) {
			css($(".layout-nav__help-user-ids"), "display", "none");

        }
	} catch {
	}
}

var footer_ids = [];

function addFooterSpan(id, txt, func = null) {
	if ($("#" + id)) {
		let p = $("#" + id).parentNode;
		if (p)
			p.remove();
	}

	if (!footer_ids.includes(id)) footer_ids.push(id);

	let btn = document.createElement('button');
	let spn = document.createElement('span');
	spn.id = id;
	spn.className = "user-control-menu-button-label";
	spn.textContent = txt;
	btn.appendChild(spn);
	$('.help-list-item')[0].appendChild(btn);

	let space = document.createElement('div');
	space.textContent = " . ";
	$('.help-list-item')[0].appendChild(space);

	if (func)
		$("#" + id).onclick = function() { func(id); };
}

/**
 * Generate all combinations of an array.
 * @param {Array} sourceArray - Array of input elements.
 * @param {number} comboLength - Desired length of combinations.
 * @return {Array} Array of combination arrays.
 */
function generateCombinations(sourceArray, comboLength) {
	const sourceLength = sourceArray.length;
	if (comboLength > sourceLength) return [];

	const combos = []; // Stores valid combinations as they are generated.

	// Accepts a partial combination, an index into sourceArray, 
	// and the number of elements required to be added to create a full-length combination.
	// Called recursively to build combinations, adding subsequent elements at each call depth.
	const makeNextCombos = (workingCombo, currentIndex, remainingCount) => {
		const oneAwayFromComboLength = remainingCount == 1;

		// For each element that remaines to be added to the working combination.
		for (let sourceIndex = currentIndex; sourceIndex < sourceLength; sourceIndex++) {
			// Get next (possibly partial) combination.
			const next = [...workingCombo, sourceArray[sourceIndex]];

			if (oneAwayFromComboLength) {
				// Combo of right length found, save it.
				combos.push(next);
			}
			else {
				// Otherwise go deeper to add more elements to the current partial combination.
				makeNextCombos(next, sourceIndex + 1, remainingCount - 1);
			}
		}
	}

	makeNextCombos([], 0, comboLength);
	return combos;
}