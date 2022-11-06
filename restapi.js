
function callAPI0(std, success = null) {
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

function callAPI(std, ident = null, args = {}, success = null, async = true) {

	var json_request = JSON.stringify(stdCall(std, args, ident));
	var headers = {};

	if (!catched_headers) {
		console.log("headers missing");
		if (success) success({});
		return;
	}
	catched_headers.forEach((entry) => {
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

	var result;

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

			if (!async) result = data;

		} catch (ex) {
			console.log("EXCEPTION!");
			console.log(ex);
		}
	};
	xhr.send(json_request);

	if (!async) return result;
}

function stdCall(name, args, ident) {
	return { "calls": [{ "name": name, "args": args, "ident": (ident == null ? name : ident) }] };
}
