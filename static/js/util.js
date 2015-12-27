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
  var infoNum = document.getElementsByClassName("info").length;
  
  if(! this.INFOID)
    this.INFOID = 0;

  var newInfo = document.createElement("div");
  newInfo.setAttribute("id", "info" + this.INFOID);
  newInfo.setAttribute("class", "info");
  newInfo.innerHTML = msg;

  newInfo.style.position = "fixed";
  newInfo.style.left = "30px";
  newInfo.style.fontSize = "15px";
  newInfo.style.backgroundColor = "#3A9BD9";
  newInfo.style.color = "white";
  newInfo.style.padding = "1px 15px";
  newInfo.style.zIndex = "2";

  document.body.appendChild(newInfo);

  newInfo.style.bottom = (50 + (newInfo.offsetHeight + 5) * infoNum) + "px";

  setTimeout(function(infoID){
      document.getElementById("info" + infoID).remove();
    }, 2000, this.INFOID);

  this.INFOID++;
}

String.prototype.format = function() {
  var src = this;
  var cap;
  var subStrs = [];
  var ai = 0;
  while(src) {
    if(cap = /([^{]*){ *(\d*) *}/.exec(src)){
      src = src.substring(cap[0].length);
      subStrs.push(cap[1]);
      if(cap[2]) {
        subStrs.push(arguments[parseInt(cap[2])]);
      } else {
        subStrs.push(arguments[ai++]);
      }
    } else {
      subStrs.push(src);
      src = '';
    }
  }

  subStrs.forEach(function(s, i){
    src += s;
  });
  return src;
}