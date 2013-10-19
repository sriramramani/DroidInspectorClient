function Tree() {
	this.root = null;
	this.dom = null;

    // The idea of setting them in css as background image is good.
    // But chrome hates it!
    this.openImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAM0lEQVQokWNgGGGgrKysgSTF5eXl/0lSTJQGZMUENaArxqsBm2KcGnApxqoBn+Ly8vL/AFxFUgEe+EoeAAAAAElFTkSuQmCC";

    this.closeImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAYAAABWdVznAAAAVElEQVQokWNgoBYoKyub6uDgwEK0hvLy8v/l5eW7MzMzBUnR8L+8vPxmUVGRGika/peXl78rKSlxIUXD//Ly8t9lZWVZNNNAkpNI8jTxwUpyxOECAFzbU9Gxd3RrAAAAAElFTkSuQmCC";
}

Tree.prototype = {
	init: function(dom, json) {
		this.dom = document.getElementById(dom);
		this.root = json;

		this.selectedNode = this.root;
		this.root.isSelected = true;
		this.addChildren(this.dom, this.root);
		this.refresh(this.dom.children[0]);
		
		document.addEventListener("Tree:ShowAll", this, false);
		document.addEventListener("Tree:ExpandAll", this, false);
        document.addEventListener("Node:Select", this, false);
		
		var event = new CustomEvent("Node:Select", { detail: this.root });
		document.dispatchEvent(event);
	},
	
	handleEvent: function(event) {
		switch (event.type) {
			case "Tree:ShowAll":
				this.showAll(this.dom.children[0]);	

				var custom = new CustomEvent("Node:Refresh");
				document.dispatchEvent(custom);

				this.refresh(this.dom.children[0]);
				break;
				
			case "Tree:ExpandAll":
				this.expandAll(this.dom.children[0]);
				break;
                
            case "Node:Select":
                this.select(event.detail);
                break;
		}
	},
	
	addChildren: function(ul, node) {
		var li = document.createElement("li");
		ul.appendChild(li);
		li.node = node;

		/*
		   <li><span><img><input type="checkbox"/><label>node.name node.id</label></span>
		   		<ul></ul>
			</li>
		 */
		
        var span = document.createElement("span");
        li.appendChild(span);

		var image = document.createElement("img");
		span.appendChild(image);
		li.image = image;

		var that = this;		
		image.onclick = function() {
			that.toggle(li);
		};
		
		if (node.children.length == 0) {
			image.className = "no-child";
		} else {
            image.setAttribute("src", this.openImage);
		}
		
		var check = document.createElement("input");
        check.setAttribute("type", "checkbox");
		span.appendChild(check);
        li.check = check;
        
        check.onclick = function() {
			that.onNodeVisibilityChanged(li);
		};

		var label = document.createElement("label");
        var dotIndex = node.name.lastIndexOf('.');
        var name = dotIndex != -1 ? node.name.substring(dotIndex + 1) : node.name;
		label.innerHTML = name;
        label.setAttribute("title", node.name + " " + node.id);
		span.appendChild(label);
		li.label = label;
		this.setLabelClass(li);

		label.onclick = function() {
			that.select(node);
		}
		
		var childUL = document.createElement("ul");
		li.appendChild(childUL);
		li.ul = childUL;
		
		for (var i = 0, len = node.children.length; i < len; i++) {
			this.addChildren(childUL, node.children[i]);
		}
	},
	
	refresh: function(li) {
		li.check.checked = li.node.isShowing();
		li.check.disabled = !li.node.wouldShow();
		this.setLabelClass(li);
		
		for (var i = 0, len = li.ul.children.length; i < len; i++) {
			this.refresh(li.ul.children[i]);
		}
	},
	
	setLabelClass: function(li) {
		var className = "";
		if (li.node.visibility == 0) {
			className = "gone";
		} else if (li.node.visibility == -1) {
			className = "invisible";
		} else {
			className = (li.node.isSelected ? "selected" : "");
		}
		
		li.label.setAttribute("class", className);
	},
	
	toggle: function(li) {
		var ul = li.ul;
		if (ul.className.search("hidden") > -1) {
			ul.className = "";
			li.image.setAttribute("src", this.openImage);
		} else {
			ul.className = "hidden";
			li.image.setAttribute("src", this.closeImage);
		}
	
	},
	
	select: function(node) {
		if (this.selectedNode === node) {
			return;
		}
		this.selectedNode.isSelected = false;
		
		node.isSelected = true;
		this.selectedNode = node;

		var event = new CustomEvent("Node:Select", { detail: node });
		document.dispatchEvent(event);
		
		this.refresh(this.dom.children[0]);
	},
	
	onNodeVisibilityChanged: function(li) {
		li.node.show(li.check.checked);
		
		var event = new CustomEvent("Node:Refresh");
		document.dispatchEvent(event);
		
		// TODO: Grayed check boxes.
		// this.refresh(this.dom.children[0]);
	},
	
	showAll: function(li) {
		li.node.show(true);
		for (var i = 0, len = li.ul.children.length; i < len; i++) {
			this.showAll(li.ul.children[i]);
		}
	},
	
	expandAll: function(li) {
		li.ul.className = "";
		for (var i = 0, len = li.ul.children.length; i < len; i++) {
			this.expandAll(li.ul.children[i]);
		}
	}
}