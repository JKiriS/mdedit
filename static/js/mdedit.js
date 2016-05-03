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
  this.PREVIEW = false;

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
  if(this.syncScrollDelay)
      clearTimeout(this.syncScrollDelay);

  var that = this;

  this.syncScrollDelay = setTimeout(function(){
    var editorLine = that.editor.getFirstVisibleRow();
    
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
}

MDEditor.prototype.getText = function() {
  return this.editor.getValue();
}

function resize(){

  var bodyWidth = $(window).width();
  var bodyHeight = $(window).height();

  if(! mdeditor.PREVIEW){
    mainWidth = Math.min(Math.max(bodyWidth * 0.95, 900), bodyWidth - 20);
    mainHeight = bodyHeight - 90;
    $("div.main").outerWidth(mainWidth);
    $("div.main").css("left", (bodyWidth - mainWidth) / 2 + "px");
    $("div.main").css("top", "70px");
    $("div.main").outerHeight( mainHeight );
    $("div.main").css("margin-bottom", "0px");

    $("#editor").show();
    $("#editor").outerHeight( mainHeight );
    $("#editor").outerWidth( mainWidth * 0.5 );

    $("#preview").outerWidth( mainWidth * 0.5 );
    $("#preview").outerHeight( mainHeight );
    
    $("#preview").removeClass("preview");
    $("#preview").css("margin-left", "0px");
  } else {
    mainWidth = Math.min(Math.max(bodyWidth * 0.6, 800), bodyWidth - 20);
    mainHeight = bodyHeight - 90;
    $("div.main").outerWidth(mainWidth);
    $("div.main").css("left", (bodyWidth - mainWidth) / 2 + "px");
    $("div.main").css("top", "70px");
    $("div.main").css("height", "");
    $("div.main").css("margin-bottom", "20px");

    $("#editor").hide();
    $("#preview").addClass("preview");

    $("#preview").css("height", "100%");
    $("#preview").outerWidth( mainWidth );
  }
  
}

var mdeditor = new MDEditor("editor", "preview");
resize();
mdeditor.editor.resize();

$(document).ready(function(){
  mdeditor.render();
});

//
$(window).resize(function(event){
  resize();
  mdeditor.editor.resize();
});