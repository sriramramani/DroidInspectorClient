var COLOR_DRAWABLE = new RegExp("#(\\w{2})(\\w{2})(\\w{2})(\\w{2})");

function Rectangle(_x, _y, _width, _height) {
    this.x = _x;
    this.y = _y;
    this.width = _width;
    this.height = _height;
}

Rectangle.prototype.intersects = function(anotherRect) {
    return (this.x < (anotherRect.x + anotherRect.width) &&
            (this.x + this.width) > anotherRect.x &&
            this.y < (anotherRect.y + anotherRect.height) &&
            (this.y + this.height) > anotherRect.height);
};

function Node(node, parent) {
    this.name = node.name;
    this.id = node.id;
    
    if (node.backgroundImage != undefined) {
        this.backgroundImage = node.backgroundImage;
    } else if (node.backgroundColor != undefined) {
        var colors = node.backgroundColor.split(COLOR_DRAWABLE);
        this.backgroundColor = Node.getFloatColors(colors);
    }
    
    if (node.content != undefined) {
        this.content = node.content;
    }
    
    this.padding = node.padding || [0, 0, 0, 0];
    this.margin = node.margin || [0, 0, 0, 0];
    this.drawablePadding = node.drawablePadding || [0, 0, 0, 0];
    this.parent = parent;
    this.depth = 1;
	this.isSelected = false;
    this.isShown = true;
	this.isBackgroundShown = true;
	this.isContentShown = true;
    this.visibility = node.visibility;
    this.pickColor = Node.getNextColor();
    
    if (this.pickColor[0] == this.pickColor[1] == this.pickColor[2] == 0.2) {
        this.pickColor = Node.getNextColor();
    }
    
    this.maxBounds = null;
    this.children = node.children;

    var bounds = node.bounds;
    this.bounds = new Rectangle(bounds[0], bounds[1], bounds[2], bounds[3]);
}

Node.getFloatColors = function(colors) {
    var floats = [];
    for (var i = 1; i < 5; i++) {
        floats.push(parseInt(colors[i], 16) / 255);
    }
    
    // Rotate to make the alpha the last value in the array.
    floats.push(floats.shift());
    return floats;
}

Node.prototype = {
    show: function(doShow) {
        this.isShown = doShow;
    },

    isShowing: function() {
        return this.isShown;
    },

    isVisible: function() {
        return (this.visibility == 1);
    },

    /*
     * Returns whether the 3D view will show this or not.
     */
    wouldShow: function() {
        return this.isShowing() && this.isVisible();
    },
	
	hasBackground: function() {
		return (this.backgroundColor != undefined || (this.backgroundImage != undefined && this.backgroundTexture != undefined));
	},
	
	hasContent: function() {
		return (this.content != undefined && this.contentTexture != undefined);
	},

    calculateDepth: function() {
        // Ask children to calculate first.
        this.children.forEach(function(node) {
            node.calculateDepth();
        });

        // Default depth.
        this.depth = 1;

        if (this.parent == null || !this.wouldShow()) {
            return;
        }

        var children = this.parent.children;
        for (var i = 0, len = children.length; i < len; i++) {
            var child = children[i];

            // May be do a hashcode matching.
            if (child === this) {
                break;
            }

            if (child.wouldShow() && (this.maxBounds.intersects(child.maxBounds))) {
                // There is an overlapping, make this depth the maximum of so-far and the sibling's max-depth.
                this.depth = Math.max(this.depth, this.getMaxDepth() + 1);
            }
        }
    },
    
    calculateMaxBounds: function(){
        this.maxBounds = this.bounds;

        var totalBounds = new Rectangle(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
        for (var i = 0, len = this.children.length; i < len; i++) {
            var child = this.children[i];

            // Calculate child's bounds.
            child.calculateMaxBounds();

            if (!this.wouldShow()) {
                continue;
            }

            var bounds = child.maxBounds;
            if (bounds.x < 0) {
                totalBounds.x = bounds.x;
            }

            if (bounds.y < 0){
                totalBounds.y = bounds.y;
            }

            if ((bounds.x + bounds.width) > totalBounds.width) {
                totalBounds.width = (bounds.x + bounds.width - totalBounds.x);
            }

            if ((bounds.y + bounds.height) > totalBounds.height) {
                totalBounds.height = (bounds.y + bounds.height - totalBounds.y);
            }
        }

        this.maxBounds = totalBounds;
    },

    /*
     * Returns the maximum depth of a tree rooted at this node.
     */
    getMaxDepth: function() {
        if (this.children.length == 0) {
            return this.depth;
        }

        var maxDepth = 0;
        var areas = [];
        for (var i = 0, len = this.children.length; i < len; i++) {
            var child = this.children[i];
            if (!child.wouldShow()) {
                continue;
            }

            var childDepth = child.getMaxDepth();
            var bounds = child.maxBounds;
            for (var j = 0, al = areas.length; j < al; j++) {
                var area = areas[j];
                if (area.intersects(bounds)) {
                    maxDepth = Math.max(maxDepth, childDepth);
                }
            }

			areas.push(bounds);
            maxDepth = Math.max(maxDepth, childDepth);
        }

        return maxDepth + this.depth;
    }
};

function processNodes(node, parent) {
    if (node === null) {
        return;
    }

    node = new Node(node, parent);
    
    for (var i = 0, len = node.children.length; i < len; i++) {
        var child = processNodes(node.children[i], node);
        node.children[i] = child;
    }
    return node;
}

Node.getNextColor = (function() {
    var red = 0, green = 0, blue = 0;
    var COLOR_ARRAY = [0.1, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];

    // Values are closed by this function.
    // This is the effective function executed when getNextColor() is called.
    return function() {
        blue++;
        if (blue == COLOR_ARRAY.length) {
            blue = 0;
            green++;
            if (green == COLOR_ARRAY.length) {
                green = 0;
                red++;
            }
        }
    
        return [COLOR_ARRAY[red], COLOR_ARRAY[green], COLOR_ARRAY[blue], 1.0];
    };
})();