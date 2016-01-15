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
      marked.equations.push(mid);
      return '<div id="' + mid + '" line="' + line + '">\\['+ text +'\\]</div>';
    }
  }
  return '';
};

// MathJax.Hub.Config({
//       showProcessingMessages: false,
//       tex2jax: { 
//        inlineMath: [ ['$','$'],['\\(','\\)'] ],
//        displayMath: [ ['$$','$$'], ["\\[","\\]"] ],
//        processEscapes: true
//       },
//     });

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

// init ace editor
var editor = ace.edit("editor");
editor.getSession().setMode("ace/mode/markdown");
editor.setShowPrintMargin(false);
editor.getSession().setUseWrapMode(true);
editor.renderer.setScrollMargin(0, 10, 0, 0);

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

    mainWidth = bodyWidth * 0.9;
    mainHeight = bodyHeight - 90;
    $("div.main").outerWidth(mainWidth);
    $("div.main").css("left", bodyWidth * 0.05 + "px");
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

    mainWidth = bodyWidth * 0.6;
    mainHeight = bodyHeight - 90;
    $("div.main").outerWidth(mainWidth);
    $("div.main").css("left", bodyWidth * 0.2 + "px");
    $("div.main").css("top", "70px");
    $("div.main").css("height", "");
    $("div.main").css("margin-bottom", "20px");

    $("#editor").hide();
    $("#preview").addClass("preview");

    var maxWidth = 900;
    $("#preview").css("height", "100%");
    $("#preview").outerWidth( mainWidth );

  }
  
}


//
resize();
editor.resize();

$(document).ready(function(){
  render();
});

//
$(window).resize(function(event){
  resize();
  editor.resize();
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