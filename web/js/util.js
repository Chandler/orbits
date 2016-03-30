function keys(obj){
  var arr = [];
  var has = Object.prototype.hasOwnProperty;

  for (var i in obj) {
    if (has.call(obj, i)) {
      arr.push(i);
    }
  }
  return arr;
};

function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

function diffMinutes(date, minutes) {
    return new Date(date.getTime() + minutes*60000);
}

function SatColors() {
    var purple        = "#B54BC1"
    var cyan          = "#13E2EC"
    var red           = "#FF0000"
    var blue          = "#0089FF"
    var light_green   = "#96D811"
    var orange        = "#FF9800"
    var teal          = "#009688"
    var yellow        = "#FFEB3B"
    var grey          = "#9E9E9E"
    var darker_purple = "#42178E"
    var puke_green    = "#CDDC39"
    var brown         = "#795548"
    var white         = "#FFFFFF"
    var hot_pink      = "#F900FD"

    this.colors = [
        light_green,  
        cyan,         
        red,          
        orange,       
        hot_pink,     
        blue,         
        purple,       
        teal,         
        yellow,      
        puke_green,   
        brown
    ]

    this.colorIndex = 0
}

// when you run out of colors start at the top again
SatColors.prototype.next = function() {
    var color = this.colors[this.colorIndex]
    if (this.colorIndex >= this.colors.length - 1) {
        this.colorIndex = 0
    } else {
        this.colorIndex = this.colorIndex + 1
    }
    return color
}

// convertss #123 to 0x123
SatColors.hexNotation = function(color) { return "0x" + color.slice(1, color.length)}
