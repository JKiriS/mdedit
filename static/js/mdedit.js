MathJax.Hub.Config({
  showProcessingMessages: false,
  tex2jax: { 
   inlineMath: [ ['\\(','\\)'] ],
   displayMath: [ ["\\[","\\]"] ],
   processEscapes: true
  },
});

// extend and init marked.js
function MDEditor(eid, pid) {
  this.eid = eid;
  this.pid = pid;
  this.equations = [];

  var that = this;
  this.renderer = new marked.Renderer();
  this.renderer.math = function (text, type, line) {
    if(type == 'inline'){
      var mid = 'MathJax-S-' + text.trim().hashCode();

      var ele = document.getElementById(mid);
      if(ele){
        return ele.outerHTML;
        }
      else{
        that.equations.push(mid);
        return '<span id="' + mid + '">\\(' + text +'\\)</span>';
      }
    } 
    else if(type == 'block'){
      var mid = 'MathJax-D-' + text.trim().hashCode();

      var ele = document.getElementById(mid);
      if(ele){
        return ele.outerHTML;
      }
      else{
        that.equations.push(mid);
        return '<div id="' + mid + '" line="' + line + '">\\['+ text +'\\]</div>';
      }
    }
    return '';
  };

  this.options = {
    renderer: this.renderer,
    gfm: true,
    tables: true,
    breaks: true,
    pedantic: true,
    sanitize: false,
    smartLists: true,
    smartypants: true
  };

  marked.setOptions(this.options);

  this.editor = ace.edit(this.eid);
  this.editor.getSession().setMode("ace/mode/markdown");
  this.editor.setShowPrintMargin(false);
  this.editor.getSession().setUseWrapMode(true);
  this.editor.setOption("scrollPastEnd", 0.5);
  this.editor.renderer.setShowGutter(false);
  this.editor.renderer.setScrollMargin(0, 10, 0, 0);

  this.CHANGED = false;
  this.syncScrollDelay = null;
  
  this.PREVIEW = 1;
  this.EDIT = 2;
  this.BOTH = 0;
  this.MODE = this.BOTH;

  this.editor.getSession().on('change', function(e) {
    that.render();
    that.syncScroll();
    that.CHANGED = true;
  });

  this.editor.getSession().on('changeScrollTop', function(scroll) {
    that.syncScroll();
  });
}

MDEditor.prototype.render = function() {
  if(this.MODE == this.EDIT)
    return ;

  var md = this.editor.getValue();

  this.equations = [];

  document.getElementById(this.pid).innerHTML = marked(md);

  $("#{} pre".format(this.pid)).addClass("prettyprint linenums");
  prettyPrint();
  $("#{} pre".format(this.pid)).each(function(i, ei){
    var line = parseInt($(ei).attr('line'));
    $(ei).find('li').each(function(j, ej){
      $(ej).attr('line', line+j);
    });
  });

  for(var i=0; i < this.equations.length; i++){
    var mid = this.equations[i];

    var ele = document.getElementById(mid);
    MathJax.Hub.Queue(
        ["Typeset", MathJax.Hub, ele]
      );
  }
};

MDEditor.prototype.syncScroll = function() {
  if(this.MODE != this.BOTH)
    return ;

  if(this.syncScrollDelay)
      clearTimeout(this.syncScrollDelay);

  var that = this;

  this.syncScrollDelay = setTimeout(function(){
    var editorLine = that.editor.getFirstVisibleRow() + 1;
    
    var lines = $("#" + that.pid).find("[line]");
    var i = 0;
    for(; i < lines.length; i++){
      if(parseInt($(lines[i]).attr("line")) > editorLine)
        break;
    }
    if(i > 0){
      var container = $("#" + that.pid);
      var scrollTo = $(lines[--i])
      container.animate({ 
          scrollTop: scrollTo.offset().top - container.offset().top + container.scrollTop()
      }, 300);
    }
  }, 100);
  
};

MDEditor.prototype.addCommand = function(name, bindKey, callback, global) {
  this.editor.commands.addCommand({
      name: name,
      bindKey: {win: 'Ctrl-' + bindKey,  mac: 'Command-' + bindKey},
      exec: callback,
      readOnly: false 
  });

  if(global) 
    $(document).keydown(function(event){
      if(event.ctrlKey && event.keyCode == bindKey.charCodeAt(0)){
        event.preventDefault();

        callback(event);
      }
    });
};

MDEditor.prototype.getText = function() {
  return this.editor.getValue();
};

MDEditor.prototype.resize = function(){
    this._resize();
    this.editor.resize();
    this.render();
};

MDEditor.prototype._resize = function(){
  ;
};

var mdeditor = new MDEditor("editor", "preview");


$(document).ready(function(){
  mdeditor.resize();
  mdeditor.render();
});

//
$(window).resize(function(event){
  mdeditor.resize();
});