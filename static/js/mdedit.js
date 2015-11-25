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

$.post = function(url, args, success, dataType, error) {
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
        if(success)
          success(response);
    },
    error: function(response) {
        if(error)
          error(response);
    }
  });
};

// info
function info(msg){
  var infoNum = $(".info:not(.empty)").length;
  var emptyInfo = $(".info.empty")
  var newInfo = emptyInfo.clone(true);

  newInfo.html(msg);
  newInfo.removeClass("empty");
  newInfo.attr("id", "info" + this.INFOID);

  emptyInfo.before(newInfo);
  newInfo.css("bottom", (50 + (newInfo.outerHeight() + 5) * infoNum) + "px");

  setTimeout("info.remove(" + this.INFOID + ")", 2000);

  this.INFOID++;
}

info.INFOID = 0;

info.remove = function(infoID){
  $("#info" + infoID).remove();
}


// extend and init marked.js
var renderer = new marked.Renderer();

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


marked.equations = [];


//
var CHANGED = false
  , syncScrollDelay = null
  , PREVIEW = false;


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
  }, 'json', function(rep){
    info("网络错误");
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

  var bodyWidth = $(window).width();
  var bodyHeight = $(window).height();

  if(! PREVIEW){
    $("#editor").show();
    $("#editor").outerHeight( bodyHeight );
    $("#editor").outerWidth( bodyWidth * 0.5 );

    $("#preview").outerWidth( bodyWidth * 0.5 );
    $("#preview").outerHeight( bodyHeight );
    
    $("#preview").removeClass("preview");
    $("#preview").css("margin-left", "0px");
  } else {
    $("#editor").hide();

    $("#preview").addClass("preview");

    var bodyWidth = $("body").width();
    var maxWidth = 900;
    $("#preview").css("height", "100%");
    if(bodyWidth > maxWidth){
      $("#preview").css("width", maxWidth + "px");
      $("#preview").css("margin-left", (bodyWidth - maxWidth)/2 + "px");
    } else {
      $("#preview").css("width", bodyWidth);
      $("#preview").css("margin-left", "0px");
    }
  }
  
}


//
resize();

var editor = ace.edit("editor");
editor.getSession().setMode("ace/mode/markdown");
editor.setShowPrintMargin(false);
editor.getSession().setUseWrapMode(true);

editor.resize();
editor.renderer.setScrollMargin(0, 10, 0, 0);

$(document).ready(function(){
  render();
})


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


function titleTags(){
  $(".title").show();
  $("#title").focus();
}

function goToList(){
  save();
  window.location.href = "/l";
}

function newArticle(){
  save();
  window.location.href = "/a/";
}


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
      titleTags();
    },
    readOnly: false 
});

editor.commands.addCommand({
    name: 'list',
    bindKey: {win: 'Ctrl-L',  mac: 'Command-L'},
    exec: function(editor) {
      goToList();
    },
    readOnly: false 
});

editor.commands.addCommand({
    name: 'new',
    bindKey: {win: 'Ctrl-O',  mac: 'Command-O'},
    exec: function(editor) {
      newArticle();
    },
    readOnly: false 
});

editor.commands.addCommand({
    name: 'preview',
    bindKey: {win: 'Ctrl-P',  mac: 'Command-P'},
    exec: function(editor) {
      preview();
    },
    readOnly: false,
    global: true
});

function preview(){

  PREVIEW = !PREVIEW;
  resize();
}

$(document).keydown(function(event){
  if(event.ctrlKey && event.keyCode == 'P'.charCodeAt(0)){
    event.preventDefault();

    preview();
  }
});
