var catched_headers = null;
var LastRequestId = 0;

//browser.runtime.onMessage.addListener(notify);
browser.runtime.onMessage.addListener(async (msg, sender) => {
	notify(msg);
});


console.log("HWQS page!");

var running_check = setInterval(checkHWRunningTimer, 2000);

var quests_done = 0;
var quests_requested = 0;
var timer_do_quests = null;
var buttons_added = false;

var chestBuy_done = false;
var offerFarmReward_done = false;
var subscriptionFarm_done = false;
var zeppelinGiftFarm_done = false;

function checkHWRunningTimer() {

	browser.runtime.sendMessage("ping");  // response are catched_headers from proxy (see notify)

	if (!buttons_added) {
		// $(".layout-footer").css("background-color", "darkgreen");

		addFooterSpan("Something", "quick", btnClick);
		addFooterSpan("GetDailyQuests", "daily", btnClick);
		addFooterSpan("RaidOutland", "outland", btnClick);
		addFooterSpan("Tower", "tower", btnClick);
		addFooterSpan("Expeditions", "expeditions", btnClick);
		addFooterSpan("hwqsstatus", "...");

		buttons_added = true;
	}
}

function setStatus(txt) {
	try {
		$("#hwqsstatus").text(txt);
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
	}
	
	if (id == "GetDailyQuests") {
		quests_requested = 0;
		quests_done = 0;
		if (timer_do_quests) 
			clearInterval(timer_do_quests);
		else
			timer_do_quests = setInterval(do_quests, 1000);
	}
	
	if (id == "RaidOutland") {
		RaidOutland();
		$("#" + id).parent().remove();
	}
	
	if (id == "Tower") {
		setTimeout(function () {
			FullTower();
			// todo:   $("#" + id).parent().remove();
		}, 100);
	}
	
	if (id == "Expeditions") {
		setTimeout(function () {
			StartNextExpeditions();
		}, 100);
	}
}

function do_quests() {
	
	setStatus(quests_done.toString() + " quests done");

	quests_requested++;
	if (quests_requested > 4) {
		clearInterval(timer_do_quests);
		return;
	}
	
	callAPI0("questGetAll", function (result) {
		
		result.forEach((quest) => {
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
		});
	});
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChestNr() {
	return Math.floor(Math.random() * (2 - 0 + 1)) + 0;
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

function GetReadyExpeditions() {
	setStatus(`searching...`);
	var result = callSync("expeditionGet", {});
	try {
		var i = 0;
		for (let [key, item] of Object.entries(result)) {
			try {
				if (item.status && item.status == 2) {
					i++;
					if (item.endTime && new Date(item.endTime) < new Date())
						callSync("expeditionFarm", { "expeditionId": item.id });
				}
			}
			catch
			{
			}

			try {
				for (let [kk, ii] of Object.entries(item)) {
					if (ii.status && ii.status == 2) {
						i++;
						if (ii.endTime && new Date(ii.endTime) < new Date())
							callSync("expeditionFarm", { "expeditionId": ii.id });
					}
				}
			}
			catch
			{
			}
		}
		setStatus(`${i} expeditions ready`);
	}
	catch
	{
	}
}

function StartNextExpeditions() {
	setStatus("searching for new expeditions...");

	var power_of_heroes = {};
	var heroes = [];
	var heroes_done = [];

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

	var result_exp = callSync("expeditionGet", {});
	var exps = [];
	try {
		for (let [key, item] of Object.entries(result_exp)) {
			try {
				var still_running = false;

				if (item.status && item.endTime && new Date(item.endTime) > new Date())
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

					if (ii.status && ii.endTime && new Date(ii.endTime) > new Date())
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

function RaidOutland() {

	var result = callSync("bossGetAll");
	try {
		var bosses = 0;
		var raids = 0;

		for (let [key, item] of Object.entries(result)) {
			bosses++;
			if (item.mayRaid == true) {
				raids++;
				callSync("bossRaid", { "bossId": item.id, "amount": 1, "starmoney": 0});
				callSyncIdent("bossOpenChest", { "bossId": item.id, "amount": 1, "starmoney": 0 }, "group_1_body");
			}
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

function callAPI0(std, success=null) {
	callAPI(std, "body", {}, function (data) {
		success(data.results[0].result.response);
	});
}

function callSync(std, args = {}) {
	var result = null;
	callAPI(std, "body", args = args, function (data) {
		result = data.results[0].result.response;
	}, false);
	return result;
}

function callSyncIdent(std, args = {}, ident) {
	var result = null;
	callAPI(std, ident, args = args, function (data) {
		result = data.results[0].result.response;
	}, false);
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
	
	$.ajax({
		type: "POST",
		url: "https://heroes-wb.nextersglobal.com/api/",
		data: json_request,
		contentType: "application/json; charset=utf-8",
		dataType: "json",
		headers: headers,
		async: async,
		success: function(data) {
			try {
				// console.log(JSON.stringify(data));
				if (data && data.error) {
					if (data && data.error.description) 
						console.log("ERROR : " + data.error.description);
					else
						console.log("ERROR : " + data.error);
				}
				if (success) success(data);
			} catch { }
		},
		error: function(errMsg) {
			console.log(errMsg);
		}
	});
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
			for (const fid of footer_ids) {
				$("#" + fid).parent().css("background-color", "green").css("color", "white");
			}
			colors_done = true;
        }
	} catch {
	}
}

var footer_ids = [];

function addFooterSpan(id, txt, func = null) {
	$("#" + id).parent().remove();

	if (!footer_ids.includes(id)) footer_ids.push(id);

	var btn = $("<button class='user-control-menu-button' />");
	var spn = $("<span id='" + id + "' class='user-control-menu-button-label'>" + txt + "</span>");
	btn.append(spn);
	$(".help-list-item").append(btn).append($("<div>&nbsp;</div>"));
	
	btn.on("click", function() { func(id); });
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