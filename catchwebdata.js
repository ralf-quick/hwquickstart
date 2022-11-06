var LastRequestId = null;
var catched_headers = null;

console.log('HWQS proxy started');

var client_data = {};

browser.runtime.onMessage.addListener(async (msg, sender) => {
	notify(msg);
});

browser.webRequest.onBeforeSendHeaders.addListener(inspectRequest, {urls: ["<all_urls>"]}, ['requestHeaders']);

function sendMessageToTabs(tabs) {
  for (const tab of tabs) {
    browser.tabs
		.sendMessage(tab.id, { ping: true, lastrequestid: LastRequestId, catched_headers: catched_headers, data: client_data })
      .catch(onError);
  }
}

function sendDataToTabs(tabs) {
  for (const tab of tabs) {
    browser.tabs
      .sendMessage(tab.id, { ping: false, data: client_data })
      .catch(onError);
  }
}

function notify(message) {
	try {
		if (message && message == "ping") {
			browser.tabs
				.query({ currentWindow: true, active: true, })
				.then(sendMessageToTabs)
				.catch(onError);
		}
		if (message && message.store && message.what && message.value) {
			client_data[message.what] = message.value;
		}
	} catch (ex) {
		console.log(`exception: ${ex}`);
	}
}

function inspectRequest(details) {
	if (!details) return;
	if (!details.url) return;
	if (!details.url.includes("/api")) return;
	
	// console.log(`inspect request: `, details);
	
	details.requestHeaders.forEach((entry) => {
		if (entry.name == "X-Request-Id") {
			LastRequestId = parseInt(entry.value);
			catched_headers = details.requestHeaders;
		}
	});
	return { requestHeaders: details.requestHeaders };
}

function onError(error) {
  console.error(`Error: ${error}`);
}