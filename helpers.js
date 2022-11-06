// no jQuery
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

function make_green(id) {
	try {
		let p = $("#" + id).parentNode;
		make_color(p, "white", "green");
	} catch { }
}

function make_red(id) {
	try {
		let p = $("#" + id).parentNode;
		make_color(p, "white", "green");
	} catch { }
}

function make_orange(id) {
	try {
		let p = $("#" + id).parentNode;
		make_color(p, "white", "orange");
	} catch { }
}

function make_gray(id) {
	try {
		let p = $("#" + id).parentNode;
		make_color(p, "white", "darkgray");
	} catch { }
}

function clear_color(id) {
	try {
		let p = $("#" + id).parentNode;
		make_color(p, "", "");
	} catch { }
}

function make_color(p, fg, bg) {
	try {
		css(p, "background-color", bg);
		css(p, "color", fg);
	} catch { }
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

Date.prototype.addHours = function (h) {
	this.setTime(this.getTime() + (h * 60 * 60 * 1000));
	return this;
}
