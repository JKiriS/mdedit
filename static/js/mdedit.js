// util
String.prototype.hashCode = function() {
  var hash = 0, i, chr, len;
  if (this.length == 0) return hash;
  for (i = 0, len = this.length; i < len; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

String.prototype.trim = function(){
  return this.replace(/(^[\s \n]*)|([\s \n]*$)/g, "");
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
};

$.post = function(url, args, callback, dataType) {
  if(! dataType){
    dataType = "json";
  }
  if(typeof args == "object"){
    args._xsrf = getCookie("_xsrf");
    data = $.param(args);
  } else {
    data = args;
  }
  $.ajax({
    url: url,
    data: data,
    dataType: dataType,
    type: "POST",
    success: function(response) {
        callback(response);
    }
  });
};


//
var INFOID = 0 
  , CHANGED = false
  , syncScrollDelay = null;


//
function removeInfo(infoID){
  $("#info" + infoID).remove();
}

function info(msg){
  var dn = $(".info:not(.empty)").length;
  var d = $(".info.empty").clone(true);

  d.html(msg);
  d.removeClass("empty");
  d.attr("id", "info"+INFOID);
  $(".info.empty").before(d);
  d.css("bottom", (50 + (d.outerHeight() + 5) * dn) + "px");

  setTimeout("removeInfo(" + INFOID + ")", 2000);

  INFOID++;
}

function render(){
  var md = editor.getValue();

  marked.equations = [];

  document.getElementById("preview").innerHTML = marked(md);

  for(var i=0; i<marked.equations.length; i++){
    var mid = marked.equations[i];

    var ele = document.getElementById(mid);
    MathJax.Hub.Queue(
        ["Typeset", MathJax.Hub, ele]
      );
  }
};

function save(){
  var content = editor.getValue();
  var title = document.title;
  if(title.trim() == ""){
    info("错误：标题为空");
    return ;
  }
  if(! CHANGED){
    return ;
  }
  
  $.post("", {title: title, content: content}, function(result){
    if(result.status == "ok"){
      CHANGED = false;
      info("保存成功");
      if(result.redirect)
        window.location.href = result.redirect;
    } else {
      info("错误：" + result.error);
    }
  });
}

function syncScroll(){
  var editorLine = parseInt($(".ace_gutter-cell:first").html());
  
  var lines = $("#preview").find("[line]");
  var i = 0;
  for(; i<lines.length; i++){
    if(parseInt($(lines[i]).attr("line")) > editorLine)
      break;
  }
  if(i > 0){
    $("#preview").animate({ 
        scrollTop: $("#preview").scrollTop() + $(lines[--i]).offset().top
    }, 300);
  }
}

function resize(){
  $("body").outerHeight( $(window).height()-10 );
  $("body").outerWidth( $(window).width() );
  $("#editor").outerHeight($("body").innerHeight());
  $("#editor").outerWidth($("body").innerWidth() * 0.5);
  $("#preview").outerWidth($("body").innerWidth() - $("#editor").outerWidth());
}


// extend and init marked.js
var renderer = new marked.Renderer();

marked.equations = [];

renderer.math = function (text, type, line) {
  if(type == 'inline'){
    var mid = 'MathJax-S-' + text.trim().hashCode();

    var ele = document.getElementById(mid);
    if(ele){
      return ele.outerHTML;
    }
    else{
      marked.equations.push(mid);
      return '<span id="' + mid + '" line="' + line + '">$' + text +'$</span>';
    }
  } 
  else if(type == 'block'){
    var mid = 'MathJax-D-' + text.trim().hashCode();

    var ele = document.getElementById(mid);
    if(ele){
      return ele.outerHTML;
    }
    else{
      marked.equations.push(mid);
      return '<div id="' + mid + '" line="' + line + '">$$'+ text +'$$</div>';
    }
  }
  return '';
};

marked.setOptions({
  renderer: renderer,
  gfm: true,
  tables: true,
  breaks: true,
  pedantic: true,
  sanitize: false,
  smartLists: true,
  smartypants: true
});


//
resize();

var editor = ace.edit("editor");
editor.getSession().setMode("ace/mode/markdown");
editor.setShowPrintMargin(false);
editor.getSession().setUseWrapMode(true);
render();


//
$(window).resize(function(event){
  resize();
  editor.resize();
});


// title
document.getElementById("title").addEventListener("input", function(event){
  var title = document.getElementById("title").value;
  document.title = title;

  CHANGED = true;
});

$("#title").blur(function(){
  $(".title").toggle();
});


//
editor.getSession().on('change', function(e) {
  render();
  CHANGED = true;
});

editor.getSession().on('changeScrollTop', function(scroll) {
  if(syncScrollDelay)
    clearTimeout(syncScrollDelay);
  syncScrollDelay = setTimeout(syncScroll, 100);
});


// hot key
editor.commands.addCommand({
    name: 'save',
    bindKey: {win: 'Ctrl-S',  mac: 'Command-S'},
    exec: function(editor) {
      save();
    },
    readOnly: false 
});

editor.commands.addCommand({
    name: 'title',
    bindKey: {win: 'Ctrl-M',  mac: 'Command-M'},
    exec: function(editor) {
      $(".title").show();
      $("#title").focus();
    },
    readOnly: false 
});

editor.commands.addCommand({
    name: 'list',
    bindKey: {win: 'Ctrl-L',  mac: 'Command-L'},
    exec: function(editor) {
      save();
      window.location.href = "/l";
    },
    readOnly: false 
});

editor.commands.addCommand({
    name: 'new',
    bindKey: {win: 'Ctrl-O',  mac: 'Command-O'},
    exec: function(editor) {
      save();
      window.location.href = "/a/";
    },
    readOnly: false 
});