function Box(dom) {
	var dom = document.getElementById(dom);
	this.marginLeft = document.getElementById("margin-left");
	this.marginRight = document.getElementById("margin-right");
	this.marginTop = document.getElementById("margin-top");
	this.marginBottom = document.getElementById("margin-bottom");
	
	this.drawablePaddingLeft = document.getElementById("drawable-padding-left");
	this.drawablePaddingRight = document.getElementById("drawable-padding-right");
	this.drawablePaddingTop = document.getElementById("drawable-padding-top");
	this.drawablePaddingBottom = document.getElementById("drawable-padding-bottom");
	
	this.internalPaddingLeft = document.getElementById("internal-padding-left");
	this.internalPaddingRight = document.getElementById("internal-padding-right");
	this.internalPaddingTop = document.getElementById("internal-padding-top");
	this.internalPaddingBottom = document.getElementById("internal-padding-bottom");
	
	this.bounds = document.getElementById("bounds");
	
	this.background = document.getElementById("button-background");
	this.content = document.getElementById("button-content");
	
	this.node = null;
	
	document.addEventListener("Node:Select", this, false);
	document.addEventListener("Box:ToggleBackground", this, false);
	document.addEventListener("Box:ToggleContent", this, false);
}

Box.prototype = {
	handleEvent: function(event) {
		switch (event.type) {
			case "Node:Select":
				this.refresh(event.detail);
				return;
				
			case "Box:ToggleBackground":
				this.node.isBackgroundShown = !this.node.isBackgroundShown;
				break;
				
			case "Box:ToggleContent":
				this.node.isContentShown = !this.node.isContentShown;
				break;
		}
		
		this.refreshButtons();
		var event = new CustomEvent("Node:Refresh");
		document.dispatchEvent(event);
	},
	
	refreshButtons: function() {
		if (this.node.hasBackground()) {
			this.background.disabled = false;
			this.background.className = this.node.isBackgroundShown ? "selected" : "";
		} else {
			this.background.disabled = true;
		}
		
		if (this.node.hasContent()) {
			this.content.disabled = false;
			this.content.className = this.node.isContentShown ? "selected" : "";
		} else {
			this.content.disabled = true;
		}
	},
	
	refresh: function(node) {
		this.node = node;
		
		this.refreshButtons();
		
		// TODO: Use density.
		this.bounds.innerHTML = (node.bounds.width - node.padding[0] - node.padding[2]) + " x " + (node.bounds.height - node.padding[1] - node.padding[2]);
		this.marginLeft.innerHTML = node.margin[0];
		this.marginTop.innerHTML = node.margin[1];
		this.marginRight.innerHTML = node.margin[2];
		this.marginBottom.innerHTML = node.margin[3];
		
		this.drawablePaddingLeft.innerHTML = node.drawablePadding[0];
		this.drawablePaddingTop.innerHTML = node.drawablePadding[1];
		this.drawablePaddingRight.innerHTML = node.drawablePadding[2];
		this.drawablePaddingBottom.innerHTML = node.drawablePadding[3];
		
		this.internalPaddingLeft.innerHTML = node.padding[0] - node.drawablePadding[0];
		this.internalPaddingTop.innerHTML = node.padding[1] - node.drawablePadding[1];
		this.internalPaddingRight.innerHTML = node.padding[2] - node.drawablePadding[2];
		this.internalPaddingBottom.innerHTML = node.padding[3] - node.drawablePadding[3];
	}
};