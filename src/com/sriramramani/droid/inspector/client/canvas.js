// Some constants.
var DEG_TO_RAD = 3.14 / 180;
var ZOOM_FACTOR = 10.0;
var MAX_ROTATION = 89.9;
var TOUCH_SLOP = 2;

var Colors = {
    COLOR_WHITE: [1.0, 1.0, 1.0, 1.0],
    COLOR_BLACK: [0.0, 0.0, 0.0, 1.0],
    CLEAR: [0.2, 0.2, 0.2, 1.0],
    BOUNDS_SELECTION: [1.0, 0.45, 0.45, 1.0],
    BOUNDS_NORMAL: [0.33, 0.33, 0.33, 1.0],
    LAYER_BACKGROUND: [0.50, 0.658, 0.733, 0.5],
    LAYER_CONTENT: [0.976, 0.823, 0.592, 0.5],
    LAYER_NONE: [0.85, 0.85, 0.85, 0.5],
    OVERDRAW_BLUE: [0.7, 0.7, 1.0, 0.7],
    OVERDRAW_GREEN: [0.7, 1.0, 0.7, 0.7],
    OVERDRAW_RED_LOW: [1.0, 0.7, 0.7, 0.7],
    OVERDRAW_RED_HIGH: [1.0, 0.3, 0.3, 0.7]
};

function Toolbar() {
}

Toolbar.publishEvent = function(dom, type) {
	if (dom.hasAttribute("toggle")) {
		if (dom.className.search("selected") > -1) {
			dom.className = "";
		} else {
			dom.className = "selected";
		}
	}
    var event = new CustomEvent(type);
    document.dispatchEvent(event);
}

Toolbar.fromDomNode = function(id) {
    var dom = document.getElementById(id);
    var buttons = dom.getElementsByTagName("button");
    for (var i=0, len = buttons.length; i < len; i++) {
        var button = buttons[i];
        (function(button) {
            button.onclick = function() {
                Toolbar.publishEvent(button, button.getAttribute("event"));
            };
        })(button);
    }
}

function Canvas() {
	this.isOrtho = false;
	this.showDepth = true;
	this.showBounds = true;
	this.showOverdraw = true;
	this.splitContent = true;

	this.gl = null;
	this.root = null;
    
    this.camera = null;
    this.translate = null;
    this.rotate = null;
    
    this.orthoTranslate = null;
    this.orthoScale = null;
    
    // Last known mouse position that was tracked (either by down or move event).
    this.mousePosition = [];
    
    // Mouse position of the down event.
    this.mouseDownPosition = [];

    this.pickNode = null;
	this.isPicking = false;
    this.rotateNodes = true;

	this.zNear = 1.0;
	this.zFar = 4000.0;
    this.depth = 20.0;

    this.reset();

	this.projMatrix = null;
	this.mvMatrix = null;

    this.shader = {
        vertex: 0,          // attribute
        color: 0,           // attribute
        isColor: 0,         // uniform
        projMatrix: null,   // uniform
        mvMatrix: null,     // uniform
        sampler: null       // uniform
    };

	this.buffers = {
		image: null,
		color: null,
		bounds: null
	};
    
    this.toolbar = {
        mode: null,
        bounds: null,
        depth: null,
        overdraw: null,
        splitContent: null
    };
}
 
Canvas.isPowerOfTwo = function(x) {
    return (x & (x - 1)) == 0;
}
 
Canvas.nextHighestPowerOfTwo = function(x) {
    --x;
    for (var i = 1; i < 32; i <<= 1) {
        x = x | x >> i;
    }
    return x + 1;
}

Canvas.prototype = {
	init: function(node) {
		canvas = document.getElementById("canvas");
        try {
			var options = { stencil: true };
			this.gl = canvas.getContext("webgl", options) || canvas.getContext("experimental-webgl", options);
		} catch (e) {
			return;
		}
        
        glMatrix.setMatrixArrayType(Float32Array);
		this.root = node;
        this.prepareTextures(node);

		this.gl.clearColor(Colors.CLEAR[0], Colors.CLEAR[1], Colors.CLEAR[2], Colors.CLEAR[3]); 
        this.gl.clearDepth(1.0);
		this.gl.clearStencil(0.0);

		this.gl.lineWidth(1);

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.depthMask(true);
        this.gl.depthFunc(this.gl.LEQUAL);

        this.gl.enable(this.gl.STENCIL_TEST);
        this.gl.stencilFunc(this.gl.ALWAYS, 0x1, 0xf);
        this.gl.stencilOp(this.gl.INCR, this.gl.KEEP, this.gl.INCR);

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
		this.gl.blendColor(1.0, 1.0, 1.0, 1.0);
        
        this.gl.enableVertexAttribArray(0);
        this.gl.enableVertexAttribArray(1);

        this.projMatrix = mat4.create();
	 	this.mvMatrix = mat4.create();
		
		this.buffers.image = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.image);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, 4 * 7 * 4, this.gl.STREAM_DRAW);
		
		this.buffers.texture = this.gl.createBuffer();
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.texture);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, 12, this.gl.STREAM_DRAW);

		this.buffers.color = this.gl.createBuffer();
		this.buffers.bounds = this.gl.createBuffer();

		// Bind vertex indices buffer.
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.gl.createBuffer());
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), this.gl.STATIC_DRAW);
        
        canvas.addEventListener("mousedown", this, false);
        canvas.addEventListener("mousewheel", this, false);
        canvas.addEventListener("DOMMouseScroll", this, false);
        document.addEventListener("Toggle:3D", this, false);
        document.addEventListener("Toggle:Bounds", this, false);
        document.addEventListener("Toggle:Depth", this, false);
        document.addEventListener("Toggle:Overdraw", this, false);
        document.addEventListener("Toggle:SplitContent", this, false);
        document.addEventListener("Canvas:Reset", this, false);
		document.addEventListener("Node:Refresh", this, false);
		document.addEventListener("Node:Select", this, false);
		window.addEventListener("resize", this, true);
        
        this.toolbar = {
            mode: document.getElementById("button-3d"),
            bounds: document.getElementById("button-bounds"),
            depth: document.getElementById("button-depth"),
            overdraw: document.getElementById("button-overdraw"),
            splitContent: document.getElementById("button-splitcontent")
        };

        this.refreshToolbar();
        this.initShaders();
		this.resize();
	},
    
    refreshToolbar: function() {
        var toolbar = this.toolbar;
        if (this.isOrtho) {
            toolbar.mode.className = "";
            toolbar.bounds.disabled = false;
            toolbar.bounds.className = this.showBounds ? "selected" : "";
            toolbar.depth.disabled = true;
            toolbar.overdraw.disabled = false;
            toolbar.overdraw.className = this.showOverdraw ? "selected" : "";
            toolbar.splitContent.disabled = true;
        } else {
            toolbar.mode.className = "selected";
            toolbar.bounds.disabled = true;
            toolbar.depth.disabled = false;
            toolbar.depth.className = this.showDepth ? "selected" : "";
            toolbar.overdraw.disabled = true;
            toolbar.splitContent.disabled = false;
            toolbar.splitContent.className = this.splitContent ? "selected" : "";
        }
    },
    
    initShaders: function() {
        var fragmentShader = this.getShader("shader-fragment");
        var vertexShader = this.getShader("shader-vertex");
  
        var shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);
  
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS)) {
            alert("Unable to initialize the shader program.");
        }

        this.gl.useProgram(shaderProgram);
  
        this.shader.vertex = this.gl.getAttribLocation(shaderProgram, "vertex");
        this.shader.color = this.gl.getAttribLocation(shaderProgram, "color");
        this.shader.isColor = this.gl.getUniformLocation(shaderProgram, "isColor");
        this.shader.projMatrix = this.gl.getUniformLocation(shaderProgram, "projMatrix");
        this.shader.mvMatrix = this.gl.getUniformLocation(shaderProgram, "mvMatrix");
        this.shader.sampler = this.gl.getUniformLocation(shaderProgram, "sampler");    
    },
    
    getShader: function(id) {
        var shaderScript = document.getElementById(id);
        var theSource = "";
        var currentChild = shaderScript.firstChild;
  
        while(currentChild) {
            if (currentChild.nodeType == 3) {
                theSource += currentChild.textContent;
            }
            currentChild = currentChild.nextSibling;
        }
            
        // Now figure out what type of shader script we have,
        // based on its MIME type.
        var shader;
        if (shaderScript.type == "x-shader/x-fragment") {
            shader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        } else if (shaderScript.type == "x-shader/x-vertex") {
            shader = this.gl.createShader(this.gl.VERTEX_SHADER);
        } else {
            return null;  // Unknown shader type
        }

        // Send the source to the shader object
        this.gl.shaderSource(shader, theSource);
        
        // Compile the shader program
        this.gl.compileShader(shader);
        
        // See if it compiled successfully
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            alert("An error occurred compiling the shaders: " + this.gl.getShaderInfoLog(shader));
            return null;
        }

        return shader;
    },
    
    setMatrixUniforms: function() {
        this.gl.uniformMatrix4fv(this.shader.projMatrix, false, this.projMatrix);
        this.gl.uniformMatrix4fv(this.shader.mvMatrix, false, this.mvMatrix);
    },
    
    handleEvent: function(event) {
        switch (event.type) {
			case "resize":
				this.resize();
				break;

            case "DOMMouseScroll":
            case "mousewheel":
                event.preventDefault();
                this.mousescroll(event);
                break;
                
            case "mousedown":
                this.mousedown(event);
                break;
                
            case "mousemove":
                this.mousemove(event);
                break;
                
            case "mouseup":
                this.mouseup(event);
                break;
                
            case "mouseexit":
                this.mouseexit(event);
                break;
                
            case "Toggle:3D":
                this.isOrtho = !this.isOrtho;
                var toggle = new CustomEvent("Canvas:Toggle");
                document.dispatchEvent(toggle);
                this.resize(this.gl.canvas);
                this.refreshToolbar();
                break;
                
            case "Toggle:Bounds":
                this.showBounds = !this.showBounds;
                this.paint();
                break;
                
            case "Toggle:Depth":
                this.showDepth = !this.showDepth;
                this.paint();
                break;
                
            case "Toggle:Overdraw":
                this.showOverdraw = !this.showOverdraw;
                this.paint();
                break;
                
            case "Toggle:SplitContent":
                this.splitContent = !this.splitContent;
                this.paint();
                break;
                
            case "Canvas:Reset":
                this.reset();
                this.paint();
                breakl
				
			case "Node:Refresh":
			case "Node:Select":
				this.refresh();
				break;
        }
    },
    
    reset: function() {
        this.camera = [0, 0, this.zFar/2];
        this.translate = [0, 0, 0];
        this.rotate = [0, 60.0];

        this.orthoTranslate = [0, 0, 0];
        this.orthoScale = 1;
    },

	resize: function() {
		var canvas = this.gl.canvas;
		canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        var aspectRatio = canvas.width / canvas.height;

        // Reset viewport.
        this.gl.viewport(0, 0, canvas.width, canvas.height);

        // Set the projMatrix matrix.
        if (this.isOrtho) {
            // Changing top and bottom to make it draw in 4th quadrant.
            mat4.ortho(this.projMatrix, 0, canvas.width, 0, canvas.height, this.zNear, this.zFar);
        } else {
            // Perspective is viewing-angle, aspect-ratio, (-z, z).
			mat4.perspective(this.projMatrix, 45, aspectRatio, this.zNear, this.zFar);
        }
        
        this.paint();
	},
	
	paint: function() {
		// Clear the color, depth and stencil buffers.
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT | this.gl.STENCIL_BUFFER_BIT);

		mat4.identity(this.mvMatrix);
		mat4.lookAt(this.mvMatrix, [0, 0, -this.camera[2]], [0, 0, 0], [0, 1, 0]);

        // Transformations happen in the reverse.
        if (this.isOrtho) {
            // User's translation.
            mat4.translate(this.mvMatrix, this.mvMatrix, this.orthoTranslate);

			// Scale based on viewport size.
            var orthoScale = [this.orthoScale, this.orthoScale, 0];
            mat4.scale(this.mvMatrix, this.mvMatrix, orthoScale);

            // Rotate 180 degrees.
            mat4.rotateY(this.mvMatrix, this.mvMatrix, 3.14);

			// Center the nodes.
            var width = (this.gl.canvas.width - this.root.bounds.width * this.orthoScale)/2;
            var height = this.gl.canvas.height;
            mat4.translate(this.mvMatrix, this.mvMatrix, [width, height, 0]);
        } else {
            // Translate all the nodes.
            mat4.translate(this.mvMatrix, this.mvMatrix, this.translate);

            // Rotate.
			mat4.rotateX(this.mvMatrix, this.mvMatrix, this.rotate[0] * DEG_TO_RAD);
			mat4.rotateY(this.mvMatrix, this.mvMatrix, (this.rotate[1] + 180) * DEG_TO_RAD);

            // Center the nodes.
			mat4.translate(this.mvMatrix, this.mvMatrix, [-this.root.bounds.width/2, this.root.bounds.height/2, 0]);
        }

        var absX = Math.abs(this.rotate[0]);
        var absY = Math.abs(this.rotate[1]);
        this.depth = Math.max(absX, absY) * 5 / 9;

        this.drawHierarchy(this.root);

        if (!this.isPicking && this.isOrtho && this.showOverdraw) {
			var maxDepth = (this.root.getMaxDepth() + 1) * this.depth;
            for (var i = 2; i <= 5; i++) {
                this.drawOverdraw(i, maxDepth);
            }
        }

        this.gl.flush();
	},
    
    refresh: function() {
        if (this.isShowOverdraw) {
            this.gl.stencilFunc(this.gl.ALWAYS, 0x1, 0xf);
            this.gl.stencilOp(this.gl.INCR, this.gl.KEEP, this.gl.INCR);
        }

        // Do the actual paint.
        this.paint();

        if (this.isShowOverdraw) {
            this.gl.stencilFunc(this.gl.ALWAYS, 0x1, 0xf);
            this.gl.stencilOp(this.gl.INCR, this.gl.KEEP, this.gl.INCR);
        }
    },
    
    drawOverdraw: function(level, depth) {
        this.gl.stencilFunc(level == 5 ? this.gl.LEQUAL : this.gl.EQUAL, level, 0xf);
        this.gl.stencilOp(this.gl.KEEP, this.gl.KEEP, this.gl.KEEP);

		mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, depth]);

        if (level == 2) {
            this.drawColor(this.root, Colors.OVERDRAW_BLUE);
        } else if (level == 3) {
            this.drawColor(this.root, Colors.OVERDRAW_GREEN);
        } else if (level == 4) {
            this.drawColor(this.root, Colors.OVERDRAW_RED_LOW);
        } else if (level > 4) {
            this.drawColor(this.root, Colors.OVERDRAW_RED_HIGH);
        }
		
		mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, -depth]);
        
        this.gl.stencilFunc(this.gl.ALWAYS, 0x1, 0xf);
        this.gl.stencilOp(this.gl.INCR, this.gl.KEEP, this.gl.INCR);
    },
    
    createTextureFromImage: function(image) {
        var texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        var checkboard = false;
        if (!Canvas.isPowerOfTwo(image.width) || !Canvas.isPowerOfTwo(image.height)) {
            // Scale up the texture to the next highest power of two dimensions.
            var canvas = document.createElement("canvas");
            canvas.width = Canvas.nextHighestPowerOfTwo(image.width);
            canvas.height = Canvas.nextHighestPowerOfTwo(image.height);
            if (canvas.width > 1024 || canvas.height > 1024) {
                // Draw a checkerboard.
                canvas.width = canvas.height = 32;
                var ctx = canvas.getContext("2d");
                // Tsk. Tsk. A tool to find overdraw has a 2D overdraw.
                ctx.fillStyle = "rgba(192, 192, 192, 1.0)"
                ctx.fillRect(0, 0, 32, 32);
                ctx.fillStyle = "rgba(64, 64, 64, 1.0)";
                ctx.fillRect(0, 0, 16, 16);
                ctx.fillRect(16, 16, 16, 16);
                checkboard = true;
            } else {
                var ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0, image.width, image.height);
            }
            image = canvas;
        }

        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR_MIPMAP_NEAREST);
		this.gl.generateMipmap(this.gl.TEXTURE_2D);
        if (checkboard) {
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        } else {
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        }
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
        return [texture, image.width, image.height];
    },
      
    prepareTextures: function(node) {
        var that = this;
        var thatNode = node;
        if (node.backgroundImage != undefined) {
            var image = new Image();
            image.onload = function() {
                var result = that.createTextureFromImage(this);
                if (result[0] != null) {
                    thatNode.backgroundTexture = result[0];
                    thatNode.backgroundTexture.imageWidth = result[1];
                    thatNode.backgroundTexture.imageHeight = result[2];
                    that.paint();
                }
            };
            image.src = node.backgroundImage;
        }
        
        if (node.content != undefined) {
            var image = new Image();
            image.onload = function() {
                var result = that.createTextureFromImage(this);
                thatNode.contentTexture = result[0];
                thatNode.contentTexture.imageWidth = result[1];
                thatNode.contentTexture.imageHeight = result[2];
                that.paint();
            };
            image.src = node.content;
        }
        
        for (var i = 0, len = node.children.length; i < len; i++) {
            this.prepareTextures(node.children[i]);
        }
    },
	
	drawVBO: function(mode, count, data, isColor) {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.gl.createBuffer());
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STREAM_DRAW);
        this.gl.vertexAttribPointer(this.shader.vertex, 3, this.gl.FLOAT, false, 28, 0);
		this.gl.vertexAttribPointer(this.shader.color,  4, this.gl.FLOAT, false, 28, 12);
		
		this.gl.uniform1f(this.shader.isColor, isColor ? 1.0 : 0.0);
        this.setMatrixUniforms();
		
        this.gl.drawArrays(mode, 0, count);
	},
    
    drawImage: function(node, texture) {
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

		var aspectW = node.bounds.width / texture.imageWidth;
        var aspectH = node.bounds.height / texture.imageHeight;
        
		// V V V T T T T
        var vertices = [
            node.bounds.width, 0.0,                 0.0, aspectW,  0.0,     0.0, 0.0,
            0.0,               0.0,                 0.0, 0.0,      0.0,     0.0, 0.0,
            0.0,               -node.bounds.height, 0.0, 0.0,      aspectH, 0.0, 0.0,
            node.bounds.width, -node.bounds.height, 0.0, aspectW,  aspectH, 0.0, 0.0
        ];

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.image);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STREAM_DRAW);
		
		// sizeof FLOAT is 4. stride = 7 * 4 = 28. texture offset = (3 vertices * 4) = 12.
        this.gl.vertexAttribPointer(this.shader.vertex, 3, this.gl.FLOAT, false, 28, 0);
        this.gl.vertexAttribPointer(this.shader.color, 4, this.gl.FLOAT, false, 28, 12);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);

        this.gl.uniform1f(this.shader.isColor, 0.0);
        this.setMatrixUniforms();

		this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
    },
    
    drawColor: function(node, color) {
        this.gl.uniform1f(this.shader.isColor, 1.0);
        
        var colors = [];
        for (var i = 0;  i < 4; i++) {
            colors.push(color[0]);
            colors.push(color[1]);
            colors.push(color[2]);
            colors.push(color[3]);
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STREAM_DRAW);
        this.gl.vertexAttribPointer(this.shader.color, 4, this.gl.FLOAT, false, 0, 0);
        this.drawFrontFace(node, 0.0, true);
    },
    
    drawBounds: function(node, color) {
        this.gl.uniform1f(this.shader.isColor, 1.0);
        
        var colors = [];
        for (var i = 0;  i < 5; i++) {
            colors.push(color[0]);
            colors.push(color[1]);
            colors.push(color[2]);
            colors.push(color[3]);
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.bounds);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.STREAM_DRAW);
        this.gl.vertexAttribPointer(this.shader.color, 4, this.gl.FLOAT, false, 0, 0);
        this.drawFrontFace(node, 0.0, false);
        
        var front = !this.isOrtho && !this.showDepth && this.splitContent && node.isBackgroundShown && node.hasBackground() && node.isContentShown && node.hasContent();
        if (front) {
            this.drawFrontFace(node, -this.depth/2, false);
        }
    },

    drawDepth: function(node, depth, color) {
        var width = node.bounds.width;
		var height = -node.bounds.height;
        var drawColor = this.isPicking ? color : node.isSelected ? Colors.BOUNDS_SELECTION : color;
		var red = drawColor[0];
		var green = drawColor[1];
		var blue = drawColor[2];
		var alpha = drawColor[3];
		
		// V V V R G B A
        var vertices = [
            0.0,   0.0,    0.0,   red, green, blue, alpha,
            0.0,   0.0,    depth, red, green, blue, alpha,
            width, 0.0,    0.0,   red, green, blue, alpha,
            width, 0.0,    depth, red, green, blue, alpha,
            width, height, 0.0,   red, green, blue, alpha,
            width, height, depth, red, green, blue, alpha,
            0.0,   height, 0.0,   red, green, blue, alpha,
            0.0,   height, depth, red, green, blue, alpha,
            0.0,   0.0,    0.0,   red, green, blue, alpha,
            0.0,   0.0,    depth, red, green, blue, alpha
        ];
		
		this.drawVBO(this.gl.TRIANGLE_STRIP, 10, vertices, true);
		
		// Change the array to hold the bounds color
		for (var i = 0;  i < 10; i++) {
            vertices[7 * i + 3] = Colors.BOUNDS_NORMAL[0];
            vertices[7 * i + 4] = Colors.BOUNDS_NORMAL[1];
            vertices[7 * i + 5] = Colors.BOUNDS_NORMAL[2];
			vertices[7 * i + 6] = Colors.BOUNDS_NORMAL[3];
        }
		
		this.drawVBO(this.gl.LINES, 8, vertices, true);
    },
    
    drawFrontFace: function(node, depth, isFill) {
        var mode = isFill ? this.gl.TRIANGLE_STRIP : this.gl.LINE_STRIP;

        var vertices;
        if (isFill) {
            vertices = [
                0.0, 0.0, depth,
                node.bounds.width, 0.0, depth,
                0.0, -node.bounds.height, depth,
                node.bounds.width, -node.bounds.height, depth
            ];
        } else {
            vertices = [
                0.0, 0.0, depth,
                node.bounds.width, 0.0, depth,
                node.bounds.width, -node.bounds.height, depth,
                0.0, -node.bounds.height, depth,
                0.0, 0.0, depth
            ];
        }

        var buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.STREAM_DRAW);
        this.gl.vertexAttribPointer(this.shader.vertex, 3, this.gl.FLOAT, false, 0, 0);
        this.setMatrixUniforms();
        this.gl.drawArrays(mode, 0, isFill ? 4 : 5);
		this.gl.deleteBuffer(buffer);
    },

    drawDepthCube: function(node, depth) {
        this.gl.uniform1f(this.shader.isColor, 1.0);
        if (this.isPicking) {
            this.drawDepth(node, -depth, node.pickColor);
            return;
        }

        var hasBackground = node.isBackgroundShown && node.hasBackground();
        var hasContent = node.isContentShown && node.hasContent();
        
        if (hasBackground && hasContent) {
            var halfDepth = depth / 2.0;
            mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, -halfDepth]);
            this.drawDepth(node, -halfDepth, Colors.LAYER_BACKGROUND);
            
            mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, halfDepth]);
            this.drawDepth(node, -halfDepth, Colors.LAYER_CONTENT);
        } else if (hasContent) {
            this.drawDepth(node, -depth, Colors.LAYER_CONTENT);
        } else if (hasBackground) {
            this.drawDepth(node, -depth, Colors.LAYER_BACKGROUND);
        } else {
            this.drawDepth(node, -depth, Colors.LAYER_NONE);
        }
    },
    
    drawBackground: function(node) {
        if (node.backgroundTexture != undefined) {
            this.drawImage(node, node.backgroundTexture);
        } else if (node.backgroundColor != undefined) {
            this.drawColor(node, node.backgroundColor);
        }
    },
    
    drawContent: function(node) {
        this.drawImage(node, node.contentTexture);
    },

	drawHierarchy: function(node) {
        if (node == null ||
            node.bounds.width == 0 ||
            node.bounds.height == 0 ||
            !node.isShowing() ||
            !node.isVisible()) {
            return;
        }

        var depth = node.depth * this.depth;
        
        // Give a 3d depth.
        mat4.translate(this.mvMatrix, this.mvMatrix, [node.bounds.x, -node.bounds.y, depth]);
        
        var hasBackground = node.isBackgroundShown && node.hasBackground();
        var hasContent = node.isContentShown && node.hasContent();

        if (this.isPicking) {
            this.drawColor(node, node.pickColor);

            // Draw the depth, only if we show in actual mode.
            // If not, if we are splitting content, draw a layer for it.
            if (this.showDepth) {
                this.drawDepthCube(node, this.depth);
            } else if (this.splitContent && hasBackground && hasContent) {
                this.drawColor(node, node.pickColor);
            }
        } else {
            if (!this.isOrtho && this.showDepth) {
                this.gl.stencilOp(this.gl.KEEP, this.gl.KEEP, this.gl.KEEP);
                this.drawDepthCube(node, this.depth);
                this.gl.stencilOp(this.gl.INCR, this.gl.KEEP, this.gl.INCR);
            }
            
            if (hasBackground && hasContent) {
                // Both background and content are available.
                // Draw background at a depth if needed.
                var halfDepth = this.depth/2;
                if (this.splitContent) {
                    mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, -halfDepth]);
                }
                
                this.drawBackground(node);
                
                if (this.splitContent) {
                    mat4.translate(this.mvMatrix, this.mvMatrix, [0, 0, halfDepth]);
                }
                
                this.drawContent(node);
            } else if (hasBackground) {
                this.drawBackground(node);
            } else if (hasContent) {
                this.drawContent(node);
            }

			this.gl.stencilOp(this.gl.KEEP, this.gl.KEEP, this.gl.KEEP);
			if (this.isOrtho) {
                if (node.isSelected || this.showBounds) {
                    this.gl.lineWidth(node.isSelected ? 2 : 1);
                    this.drawBounds(node, node.isSelected ? Colors.BOUNDS_SELECTION : Colors.BOUNDS_NORMAL);
                }
            } else {
                if (this.showDepth) {
				    this.drawBounds(node, Colors.BOUNDS_NORMAL);
                } else {
                    this.gl.lineWidth(node.isSelected ? 2 : 1);
                    this.drawBounds(node, node.isSelected ? Colors.BOUNDS_SELECTION : Colors.BOUNDS_NORMAL);
                }
			}
            
			this.gl.stencilOp(this.gl.INCR, this.gl.KEEP, this.gl.INCR);
        }
                
        for (var i = 0, len = node.children.length; i < len; i++) {
            var child = node.children[i];
            this.drawHierarchy(child);
        }
        
        mat4.translate(this.mvMatrix, this.mvMatrix, [-node.bounds.x, node.bounds.y, -depth]);
    },
    
    pickNodeAt: function(point) {
        if (point == null || point.length != 2)
            return null;

        // Draw the hierarchy in picking mode.
        this.isPicking = true;
        this.paint();
        this.isPicking = false;

        // Find the pixel at the mouse down location.
        // This frame buffer is not transferred to the display.
        var result = new Uint8Array(4);
        this.gl.readPixels(point[0], point[1], 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, result);

        // Find the node with this pixel color.
        return this.findNodeWithPickColor(this.root, result[0]/255, result[1]/255, result[2]/255);
    },

    findNodeWithPickColor: function(node, red, green, blue) {
        if (this.isApprox(red, node.pickColor[0]) &&
            this.isApprox(green, node.pickColor[1]) &&
            this.isApprox(blue, node.pickColor[2])) {
            return node;
        }

        for (var i = 0, len = node.children.length; i < len; i++) {
            var child = node.children[i];
            var result = this.findNodeWithPickColor(child, red, green, blue);
            if (result != null) {
                return result;
            }
        }

        return null;
    },

    isApprox: function(first, original) {
        // The float values could be off by 10%.
        return (first > (original - 0.01)) && (first < (original + 0.01));
    },

    selectNode: function(node) {
        if (node == null) {
            return;
        }

        var event = new CustomEvent("Node:Select", { detail: node });
        document.dispatchEvent(event);
    },
    
    mousescroll: function(e) {
		var value = e.detail ? e.detail : e.wheelDelta;
        if (this.isOrtho) {
			var scaleX = this.gl.canvas.width / this.root.maxBounds.width;
            var scaleY = this.gl.canvas.height / this.root.maxBounds.height;
            var minScale = Math.min(scaleX, scaleY) / 2.0;
            this.orthoScale += (value * 0.01);
            if (this.orthoScale < minScale) {
                this.orthoScale = minScale;
            } else if (this.orthoScale > 2.0) {
                this.orthoScale = 2.0;
            }
        } else {
            this.camera[2] += (value * ZOOM_FACTOR);
            if (this.camera[2] >= this.zFar) {
                this.camera[2] = this.zFar - 0.1;
            } else if (this.camera[2] <= this.zNear) {
                this.camera[2] = this.zNear + 0.1;
            }
        }

        this.paint();
    },
    
    mousedown: function(e) {
        this.gl.canvas.addEventListener("mousemove", this, false);
        this.gl.canvas.addEventListener("mouseup", this, false);
        this.gl.canvas.addEventListener("mouseexit", this, false);

        var point = [e.clientX, e.clientY];
        this.mouseDownPosition = point;
        this.mousePosition = point;

        // (0,0) is at bottom-left.
        this.pickNode = this.pickNodeAt([point[0] - e.target.offsetLeft, this.gl.canvas.height - point[1] + e.target.offsetTop]);
        this.paint();

        // Perform rotation if the click was not on a node.
        this.rotateNodes = (this.pickNode == null);
    },

    mousemove: function(e) {
        var point = [e.clientX, e.clientY];
        var deltaX = this.mousePosition[0] - e.clientX;
        var deltaY = this.mousePosition[1] - e.clientY;

        if (this.isOrtho) {
            this.orthoTranslate[0] += deltaX;
            this.orthoTranslate[1] += deltaY;
        } else {
            if (this.rotateNodes) {
                this.rotate[0] += (deltaY * 4 * MAX_ROTATION / this.root.bounds.height);
                this.rotate[1] -= (deltaX * 4 * MAX_ROTATION / this.root.bounds.width);

                if (this.rotate[0] > MAX_ROTATION) {
                    this.rotate[0] = MAX_ROTATION;
                } else if (this.rotate[0] < -MAX_ROTATION) {
                    this.rotate[0] = -MAX_ROTATION;
                }

                if (this.rotate[1] > MAX_ROTATION) {
                    this.rotate[1] = MAX_ROTATION;
                } else if (this.rotate[1] < -MAX_ROTATION) {
                    this.rotate[1] = -MAX_ROTATION;
                }
            } else {
                this.translate[0] += deltaX;
                this.translate[1] += deltaY;
            }
        }

        this.mousePosition = point;
        this.paint();
    },

    mouseup: function(e) {
        this.gl.canvas.removeEventListener("mousemove", this, false);
        this.gl.canvas.removeEventListener("mouseup", this, false);
        this.gl.canvas.removeEventListener("mouseexit", this, false);

        var deltaY = this.mouseDownPosition[0] - e.clientX;
        var deltaX = this.mouseDownPosition[1] - e.clientY;

        if (Math.abs(deltaX) < TOUCH_SLOP &&
            Math.abs(deltaY) < TOUCH_SLOP) {
            this.selectNode(this.pickNode);
        }

        this.mouseDownPosition = null;
        this.mousePosition = null;
        this.paint();
    },
    
    mouseexit: function(e) {
        this.gl.canvas.removeEventListener("mousemove", this, false);
        this.gl.canvas.removeEventListener("mouseup", this, false);
        this.gl.canvas.removeEventListener("mouseexit", this, false);
    }
};
