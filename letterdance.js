(function() {
	var FRACTION_OF_SCROLL_THAT_IS_PAGE_TRANSITION = 0.7;
	var ORIGINAL_CONTENT_OPACITY = 0;
	
	var TEXT_NODE = 3;
	var ELEMENT_NODE = 1;
	
	var toArray = function(arrayLike) {
		var a = [];
		for (var i=0; i<arrayLike.length; i++) {
			a.push(arrayLike[i]);
		}
		return a;
	}
	
	var wrapTextInSpans = function(node) {
		if (node.childNodes.length == 1 && node.childNodes[0].nodeType == TEXT_NODE && node.getAttribute("data-letterdance-letter") == node.childNodes[0].nodeValue) {
			// bail out; we already have what we want
			return;
		}
		var children = node.childNodes;
		var newChildren = [];
		for (var i=0; i<children.length; i++) {
			var child = children[i];
			if (child.nodeType == TEXT_NODE) {
				var text = child.nodeValue;
				for (var j=0; j<text.length; j++) {
					var char = text[j];
					var charTextNode = document.createTextNode(char);
					if (char != '\n' && char != '\t' && char != ' ') {
						var wrapper = document.createElement("span");
						wrapper.appendChild(charTextNode);
						wrapper.setAttribute("data-letterdance-letter", char);
						newChildren.push(wrapper);
					} else {
						newChildren.push(charTextNode);
					}
				}
			} else {
				newChildren.push(child);
				if (child.nodeType == ELEMENT_NODE) {
					wrapTextInSpans(child);
				}
			}
		}
		while (node.firstChild) {
		    node.removeChild(node.firstChild);
		}
		newChildren.forEach(function(child) {
			node.appendChild(child);
		})
	}
	
	var findLetters = function(node, outputDict, outputLettersList) {
		for (var i=0; i<node.children.length; i++) {
			if (node.children[i].hasAttribute('data-letterdance-letter')) {
				var letter = node.children[i].getAttribute('data-letterdance-letter');
				if (!outputDict[letter]) {
					outputLettersList.push(letter);
					outputDict[letter] = [];
				}
				outputDict[letter].push(node.children[i]);
			} else {
				findLetters(node.children[i], outputDict, outputLettersList);
			}
		}
	}
	
	var cloneNodeWithStyle = function(node) {
		var clone = node.cloneNode(true);
		var style = getComputedStyle(node);
		['color', 'font-size', 'font-family', 'text-shadow', 'font-style', 'text-decoration', 'text-transform'].forEach(function(attr) {
			clone.style[attr] = style[attr];
		})
		return clone;
	}
	
	var Letterdance = function(node) {
		var self = this;
		self.node = node;
		if (getComputedStyle(node).position == 'static') {
			node.style.position = 'relative';
		}
				
		self.pages = toArray(node.children);
		self.pages.forEach(wrapTextInSpans);
		self.pages.forEach(function(page) {
			page.style.opacity = ORIGINAL_CONTENT_OPACITY;
		})
		
		var getPos = function(node) {
			var p = node.getBoundingClientRect();
			return {left: p.left + window.scrollX, top: p.top + window.scrollY, width: p.width, height: p.height};
		}
		
		self.overlay = document.createElement("div");
		self.node.appendChild(self.overlay);
		self.overlay.style.position = 'fixed';
		self.overlay.style.top = '0'
		self.overlay.style.left = '0'
		self.overlay.style.padding = '0'
		self.overlay.style.margin = '0'
		self.overlay.style.border = '0'
		
		self.createClones = function() {
			// what's the maximum number of each letter we need?
			var inventory = {};
			var allLetters = [];
			self.pages.forEach(function(page) {
				var letters = [];
				var instances = {};
				findLetters(page, instances, letters);
				letters.forEach(function(letter) {
					if (!inventory[letter]) {
						inventory[letter] = [];
						allLetters.push(letter);
					}
					
					var additionalInstancesNeeded = instances[letter].length - inventory[letter].length;
					for (var i=0; i<additionalInstancesNeeded; i++) {
						inventory[letter].push(instances[letter][i]);
					}
				})
			})
			
			var cloneLetters = [];
			var cloneLetterNodes = [];
			allLetters.forEach(function(letter) {
				var proto = inventory[letter][0];
				var count = inventory[letter].length;
				for (var i=0; i<count; i++) {
					cloneLetters.push(letter);
					
					var cloned = cloneNodeWithStyle(proto);
					cloned.style.position = 'absolute';
					cloned.style.display = 'block';
					cloned.style.left = '0px';
					cloned.style.top = '0px';
					setTimeout(function() {
						cloned.style.transition = 'transform 0.05s linear'; // wait for initial layout before applying transition
					}, 0)
					self.overlay.appendChild(cloned);
					cloneLetterNodes.push(cloned);
				}
			})
			
			self.cloneLetters = cloneLetters;
			self.cloneLetterNodes = cloneLetterNodes;
		}
		self.createClones();
		
		self.updateLetterPositions = function() {
			self.letterPositions = self.pages.map(function(page, i) {
				return self.computeLetterPositions(i);
			})
			// backfill:
			for (var i=self.letterPositions.length-2; i>=0; i--) {
				for (var j=0; j<self.letterPositions[i].length; j++) {
					var cur = self.letterPositions[i][j];
					var next = self.letterPositions[i+1][j];
					if (cur.opacity == 0) {
						cur.left = next.left;
						cur.top = next.top;
					}
				}
			}
			// frontfill:
			for (var i=0; i<self.letterPositions.length-1; i++) {
				for (var j=0; j<self.letterPositions[i].length; j++) {
					var cur = self.letterPositions[i][j];
					var next = self.letterPositions[i+1][j];
					if (next.opacity == 0) {
						next.left = cur.left;
						next.top = cur.top;
					}
				}
			}
			// compute transition effects:
			for (var i=0; i<self.letterPositions.length-1; i++) {
				for (var j=0; j<self.letterPositions[i].length; j++) {
					var cur = self.letterPositions[i][j];
					var next = self.letterPositions[i+1][j];
					if (next.opacity == 0) {
						next.top -= cur.height;
					} else if (cur.opacity == 0 && next.opacity == 1) {
						cur.top += next.height;
					}
					if (next.left > cur.left) {
						cur.movingRight = true;
					} else if (next.left < cur.left) {
						cur.movingLeft = true;
					}
				}
			}
		}
		
		self.getLetterPositions = function(pageIdx) {
			var page1Pos = getPos(self.pages[0]);
			var page2Pos = getPos(self.pages[self.pages.length-1]);
			var coords = page1Pos.left + ',' + page1Pos.top + ',' + page2Pos.bottom + ',' + page2Pos.right;
			if (coords != self.lastLaidOutAtCoords || !self.letterPositions) self.updateLetterPositions();
			self.lastLaidOutAtCoords - coords;
			return self.letterPositions[pageIdx];
		}
		
		self.computeLetterPositions = function(pageIdx) {
			
			var letters = [];
			var instances = {};
			var page = self.pages[pageIdx];
			var pageOffset = getPos(page);
			findLetters(page, instances, letters);
			
			var seenLetterCounts = {};
			
			var positions = [];
			for (var i=0; i<self.cloneLetterNodes.length; i++) {				
				var node = self.cloneLetterNodes[i];
				var letter = self.cloneLetters[i];
				
				var seenCount = seenLetterCounts[letter] || 0;
				seenLetterCounts[letter] = seenCount + 1;
				
				if (seenCount >= (instances[letter] || []).length) {
					positions.push({left: 0, top: 0, opacity: 0});
				} else {
					var pos = getPos(instances[letter][seenCount]);
					positions.push({left: pos.left - pageOffset.left, top: pos.top - pageOffset.top, width: pos.width, height: pos.height, opacity: 1});
				}
			}
			
			return positions;
		}
		
		self.applyLetterPositions = function(positions) {
			var nodeOffset = getPos(self.pages[0]);
			for (var i=0; i<positions.length; i++) {
				var letterClone = self.cloneLetterNodes[i];
				var pos = positions[i];
				// letterClone.style.left = pos.left + nodeOffset.left + 'px';
				// letterClone.style.top = pos.top + nodeOffset.top + 'px';
				var x = (pos.left + nodeOffset.left);
				var y = (pos.top + nodeOffset.top);
				var rotate = pos.rotation || 0;
				letterClone.style.transform = 'translate3d(' + x + 'px, ' + y + 'px, 0) rotate(' + rotate + 'deg)';
				letterClone.style.opacity = pos.opacity;
				
			}
		}
		
		var easeInOutQuad = function (t, b, c, d) {
			t /= d/2;
			if (t < 1) return c/2*t*t + b;
			t--;
			return -c/2 * (t*(t-2) - 1) + b;
		};
		
		self.interpolateLetterPositions = function(page1, page2, t) {
			if (page1 < 0) return self.getLetterPositions(page1);
			if (page2 >= self.pages.length) return self.getLetterPositions(self.pages.length-1);
			
			var tWrap = (1 - FRACTION_OF_SCROLL_THAT_IS_PAGE_TRANSITION)/2;
			t = Math.max(0, Math.min(1, (t - tWrap) / (1 - tWrap * 2)));
			t = easeInOutQuad(t, 0, 1, 1);
			
			var pos1 = self.getLetterPositions(page1);
			var pos2 = self.getLetterPositions(page2);
			var out = [];
			var lerp = function(a,b,t) {
				return a*(1-t) + b*t;
			}
			for (var i=0; i<pos1.length; i++) {
				var p1 = pos1[i];
				var p2 = pos2[i];
				
				var rotation = t * (1 - t) * 40;
				if (p1.movingLeft) rotation *= -1
				else if (p1.movingRight) rotation *= 1
				else rotation = 0;
				
				out.push({left: lerp(p1.left, p2.left, t), top: lerp(p1.top, p2.top, t), opacity: lerp(p1.opacity, p2.opacity, t), rotation: rotation});
			}
			return out;
		}
		
		self.pageCenterYs = function() {
			return self.pages.map(function(page) {
				var b = getPos(page);
				return b.top + b.height / 2;
			})
		}
		
		self.layout = function() {			
			var y = window.innerHeight/2 + window.pageYOffset;
			var pageYs = self.pageCenterYs();
			var lastPageBefore = 0;
			var firstPageAfter = null;
			for (var i=0; i<pageYs.length; i++) {
				if (pageYs[i] < y) {
					lastPageBefore = i;
				} else if (firstPageAfter === null) {
					firstPageAfter = i;
				}
			}
			if (firstPageAfter === null) firstPageAfter = self.pages.length - 1;
			var y1 = pageYs[lastPageBefore];
			var y2 = pageYs[firstPageAfter];
			var t = (y2 == y1) ? 0 : (y - y1) / (y2 - y1);
			self.applyLetterPositions(self.interpolateLetterPositions(lastPageBefore, firstPageAfter, t));
		}
		
		self.invalidateLayout = function() {
			delete self.letterPositions;
		}
		
		window.addEventListener('scroll', function() {
			self.layout();
		})
		
		window.addEventListener('resize', function() {
			self.invalidateLayout();
			self.layout();
		})
		
		self.layout();
	}
	window.Letterdance = Letterdance;
	
	document.addEventListener("DOMContentLoaded", function(event) {
		var matches = document.querySelectorAll('.letterdance');
		for (var i=0; i<matches.length; i++) Letterdance(matches[i]);
	});
})()
