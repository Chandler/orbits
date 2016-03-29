// huge thanks to Bjorn Sandvik's webgl earth tutorial
// http://blog.thematicmapping.org/2013/09/creating-webgl-earth-with-threejs.html

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


(function () {
    $.ajax({
      dataType: "json",
      url: "generated_data/tles_and_tags.json",
      success: function(sat_data) {
        var tles   = sat_data["tles"]
        var tagMap = sat_data["tags"]
        runApp(tles, tagMap)
      },
      error: function(error) {
        console.log(error)
      }
    })

    function runApp(tles, tagMap) {
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

        var colors = [
            purple,       
            cyan,         
            red,          
            blue,         
            light_green,  
            orange,       
            teal,         
            yellow,      
            grey,         
            darker_purple,
            puke_green,   
            brown,        
            white,        
            hot_pink,     
        ]

        var webglEl = document.getElementById('scene');

        if (!Detector.webgl) {
            Detector.addGetWebGLMessage(webglEl);
            return;
        }

        var width  = window.innerWidth;
        var height = window.innerHeight;

        // a scale factor to bring the earth's widths and satellite
        // coordinates down to values around 1
        var scale = 10000
        var earthRadiusKm = 6378.135 // width of the earth in kilometers

        var scene = new THREE.Scene();
        var renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height)

        var camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
        camera.position.z = 3; //position camera above north pole
        camera.position.y = 0;
        camera.position.x = 0;
        camera.rotation.order = 'YXZ'
        
        // create ambient and directional lighting
        // scene.add(new THREE.AmbientLight(0xffffff));
        scene.add(new THREE.AmbientLight(0x333333));
        var light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(10000/scale,10000/scale,10000/scale);
        scene.add(light);

        // create earth
        var radius = earthRadiusKm/scale;
        var segments = 32 // how many polygons to use when rendering the earth sphere
        var sphere = new THREE.Mesh(
                        new THREE.SphereGeometry(radius, segments, segments),
                        new THREE.MeshPhongMaterial({
                            map: THREE.ImageUtils.loadTexture('images/4kearth.jpg'),
                            specular: new THREE.Color('grey')                                
                        })
                     )
        // rotate along the X axis so that Z lines up with the north pole
        // this makes our earth fit with the ECEF coordinates which assume a Z
        // north pole. 
        // not sure what the units are but 1.6 is the rotation that gets closest to Z = north
        sphere.rotation.x = 1.6;
        scene.add(sphere)

        // add colored axi extending twice the width of earth
        scene.add(new THREE.AxisHelper((earthRadiusKm*2)/scale));

        satellites = buildSatellites(scene, tles)

        // these two variables are used for the two pieces of global state, 
        // because they have to be accessed by the onclicks and the nextdate() 
        // function and I haven't totally figured out the right way to do that yet
        var secondsPastCurrentTime = 0    
        var speedupMultiplier = 1000
        var resetAfterThisManySeconds = 86400
        var selectedTags = ["Cubesats"]
        var orbitConfig = "one_orbit"

        // controls update camera position based on mouse dragging
        var controls = new THREE.TrackballControls(camera);
        webglEl.appendChild(renderer.domElement);
        render();
        
        var count = 0

        // Main animation loop
        function render() {
            controls.update();
            var date = nextDate();
            updateSatellites(satellites, date, selectedTags, tagMap);
            updateSun(light, date)
            if (!isNaN(date)) {
                $(".time").text(dateFormat(date, "mmmm dS, yyyy, h:MM TT", true) + " UTC");    
            }
            count = count + 1
            // if(count >=10) {
            if(true) {
                requestAnimationFrame(render);  
            }
            renderer.render(scene, camera);
        }

        $('#realtime').on('click', function () {
            secondsPastCurrentTime = 0
            speedupMultiplier = 0
        })

        $('#100x').on('click', function () {
            speedupMultiplier = 100
            secondsPastCurrentTime = 0
        })

        $('#1000x').on('click', function () {
            speedupMultiplier = 1000
            secondsPastCurrentTime = 0
        })

        $('#orbits_off').on('click', function () {
            orbitConfig = "off"
        })

        $('#orbits_one_orbit').on('click', function () {
            orbitConfig = "one_orbit"
        })

        $('#orbits_one_day').on('click', function () {
            orbitConfig = "one_day"
        })

        $("#tag-selector").select2({
           data: keys(tagMap),
           multiple: true
        })

        $("#tag-selector").select2().val(selectedTags)

        $("#tag-selector").on("select2:open", function (e) {
            $(".select2-results__options").niceScroll({
                cursorborder: 'none'
            });
        });

        $("#tag-selector").on("select2:select select2:unselect", function (e) {
            selected = $(this).val()
            if (selected != null) {
                selectedTags = selected
            } else {
                selectedTags = []
            }
        })

        $("#tag-selector").select2({
            formatSelectionCssClass: function (data, container) { return "custom_selector"; },
        });

        function nextDate() {
            // assuming 60 fps for now, you could calculate the actual fps
            // http://stackoverflow.com/a/5111475/67166 like this
            fps = 60
            if (speedupMultiplier != 0) {
                if (secondsPastCurrentTime > resetAfterThisManySeconds) {
                    secondsPastCurrentTime = 0
                } else {
                    secondsPastCurrentTime = secondsPastCurrentTime + speedupMultiplier/fps
                }
            }
            
            var today = new Date();
            today.setSeconds(today.getSeconds() + secondsPastCurrentTime);
            return today;
        }

        function updateSun(light, date) {
            sunCoordinates = approximateSunPosition(date);

            light.position.set(sunCoordinates.x,sunCoordinates.y, sunCoordinates.z);
        }

        function filterSatellites(selectedTags, tagMap, satellites) {
            ids = []
            for (i = 0; i < selectedTags.length; i++) {
                ids = ids.concat(tagMap[selectedTags[i]])
            }

            var filtered = satellites.filter(function(sat) {
                return isInArray(sat.sat_id, ids)
            })

            return filtered
        }

        function updateLegend(satellites, colorMap) {
            if (satellites.length > 0) {

                var hashSet = {}

                for (var i = 0; i < satellites.length; i++) {
                    var sat = satellites[i]
                    hashSet[sat["name"]] = sat
                    var color = colorMap[sat["name"]]
                    sat.scene_object.material.color.setHex(SatColors.hexNotation(color))
                }

                var satNames = keys(hashSet)

                $("#legend").text("")
                for (var i = 0; i < satNames.length; i++) {
                    var sat = hashSet[satNames[i]]
                    var snippit = [
                        '<div>',
                        '<div class="circle" style="background-color: ', colorMap[sat["name"]], '"></div>',
                        '<div class="label-text"> <a href="', sat["url"], '">', sat["name"], '</a> </div>',
                        '</div>'
                    ].join("")
                    
                    $("#legend").append(snippit)
                }
            } else {
                $("#legend").text("")
            }
        }

        function tleRecordToEcfCoordinates(line1, line2, date) {
            // Initialize a satellite record
            var satrec = satellite.twoline2satrec(line1, line2);

            var positionAndVelocity = satellite.propagate(
                satrec,
                date.getUTCFullYear(),
                date.getUTCMonth() + 1,
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds()
            );

            var gmst = satellite.gstimeFromDate(
                date.getUTCFullYear(),
                date.getUTCMonth() + 1, // Note, this function requires months in range 1-12.
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds()
            );

            var positionEci = positionAndVelocity.position
            var positionEcf = satellite.eciToEcf(positionEci, gmst)
            return positionEcf
        }

        function updateOrbitRings(satellites, date, colorMap) {
            if (orbitConfig != "off") {
                for (var i = 0; i < satellites.length; i++) {
                    if (orbitConfig == "one_orbit") {
                        var orbitLength = 3 //TODO calculate this
                    } else if (orbitConfig == "one_day") {
                        var orbitLength = 24
                    }
                    var previousDate = date
                    var sat = satellites[i]   
                    var splinepts = [];
                    
                    function diffMinutes(date, minutes) {
                        return new Date(date.getTime() + minutes*60000);
                    }
                    var resolution = 3
                    var numPoints = ((orbitLength*60) * 0.95)/resolution
                    var geometry = new THREE.Geometry()

                    for (var j = 0; j < numPoints; j++) {
                        var currentDate = diffMinutes(previousDate, -resolution)
                        var ecf = tleRecordToEcfCoordinates(
                            sat["tle_line_1"],
                            sat["tle_line_2"],
                            currentDate
                        )

                        geometry.vertices.push(
                            new THREE.Vector3(
                                ecf.x/scale,
                                ecf.y/scale,
                                ecf.z/scale
                            )
                        )
                        var previousDate = currentDate
                    }

                    if ("orbit_object" in sat) {
                        var oldOrbitObject = sat["orbit_object"]
                        scene.remove(oldOrbitObject)
                    }

                    var newOrbitObject = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: colorMap[sat["name"]], linewidth: 2 }))
                    sat["orbit_object"] = newOrbitObject
                    scene.add(newOrbitObject)
                }
            }
        }

        function buildColorMap(satellites) {
            hashSet = {}
            var colors = new SatColors()
            for (var i = 0; i < satellites.length; i++) {
                var sat = satellites[i]
                if (!(sat["name"] in hashSet)) {
                    hashSet[satellites[i]["name"]] = colors.next()
                }
            }
            return hashSet
        }

        function updateSatellites(allSatellites, date, selectedTags, tagMap) {
            // clear all satellites
            for (var i = 0; i < allSatellites.length; i++) {
                allSatellites[i]["scene_object"].visible = false
                if ("orbit_object" in allSatellites[i]) {
                    allSatellites[i]["orbit_object"].visible = false 
                }
            }

            var satellites = filterSatellites(selectedTags, tagMap, allSatellites)
            
            function compare(a,b) {
              if (a.name < b.name)
                return -1;
              else if (a.name > b.name)
                return 1;
              else 
                return 0;
            }

            satellites.sort(compare);

            var colorMap = buildColorMap(satellites)

            updateLegend(satellites, colorMap)

            updateOrbitRings(satellites, date, colorMap)
            

            for (var i = 0; i < satellites.length; i++) {
                satellites[i]["scene_object"].visible = true

                // Initialize a satellite record
                var satrec = satellite.twoline2satrec(
                                satellites[i]["tle_line_1"],
                                satellites[i]["tle_line_2"]
                             );
                var positionAndVelocity = satellite.propagate(
                    satrec,
                    date.getUTCFullYear(),
                    date.getUTCMonth() + 1,
                    date.getUTCDate(),
                    date.getUTCHours(),
                    date.getUTCMinutes(),
                    date.getUTCSeconds()
                );

                var gmst = satellite.gstimeFromDate(
                    date.getUTCFullYear(),
                    date.getUTCMonth() + 1, // Note, this function requires months in range 1-12.
                    date.getUTCDate(),
                    date.getUTCHours(),
                    date.getUTCMinutes(),
                    date.getUTCSeconds()
                );

                // https://en.wikipedia.org/wiki/Earth-centered_inertial
                var positionEci = positionAndVelocity.position;

                // https://en.wikipedia.org/wiki/ECEF
                // ecef is the fixed earth coordinate system which is what we want
                // in this example since our earth doesn't rotate.
                // if earth was rotating instead of the sun we would need the ECI
                // coordinates I think
                var positionEcf = satellite.eciToEcf(positionEci, gmst);

                // update our satellites to their ECEF positions
                satellites[i]["scene_object"].position.x = positionEcf.x/scale;
                satellites[i]["scene_object"].position.y = positionEcf.y/scale;
                satellites[i]["scene_object"].position.z = positionEcf.z/scale;
            }
        }

        /*
         * rough approximation of the sun's xy position along the equator
         * assuming a sun that rotates around earth directly at the equator
         */
        function approximateSunPosition(date) {
            // SOLAR DECLINATION
            // Follows the calculation of the declination of the sun, again you an use a table or a formula
            // "Table of the Declination of the Sun": http://www.wsanford.com/~wsanford/exo/sundials/DEC_Sun.html
            // Or use the following formula:
            // https://gist.github.com/jgomezdans/733741/0e14042e3f66b3d804c0a54cdb6df796c70aaf32
            function solarDeclination(dayOfYear, hourOfDay) {
                radians_progress_around_sun = ((2*Math.PI)/365.25)*(dayOfYear + hourOfDay/24)
                r = radians_progress_around_sun
                declination = 0.396372-22.91327*Math.cos(r)+4.02543*Math.sin(r)-0.387205*Math.cos(2*r) + 0.051967*Math.sin(2*r)-0.154527*Math.cos(3*r) + 0.084798*Math.sin(3*r)
                // somehow this magic function operates on radians and returns degress??? 
                // convert back to rads
                return declination * (Math.PI/180); 
            }

            function dayOfYear(now) {
                var start = new Date(now.getFullYear(), 0, 0);
                var diff = now - start;
                var oneDay = 1000 * 60 * 60 * 24;
                var day = Math.floor(diff / oneDay);
                return day
            }

            // what % of the day are we through
            // in terms of hours 1-24
            dayProgress = (date.getUTCHours())/24;

            // what percent of the hour are we through
            hourProgress = (date.getUTCMinutes()/60);

            // what percent of the day are we through, at minutly granularity
            preciseProgres = dayProgress + hourProgress*(1/24);

            // the sun rotates east to west but our progress around the equator
            // goes west to east so we need to go backwards
            descendingProgress = 1-preciseProgres;

            //convert progress % to radians, 100% = 2pi
            progressToRadians = descendingProgress*2*Math.PI;

            // add one pi radians to convert from midnight to noon
            noonRadiansFromLongZero = progressToRadians + Math.PI;

            declinationOfSun = solarDeclination(dayOfYear(date), date.getUTCHours())
            
            // inclination (or polar angle)
            azimuthAngle = noonRadiansFromLongZero

            // inclination (or polar angle)
            //
            // "The elevation angle is 90 degrees (π/2 radians) minus the inclination angle"
            //
            // in our case elevation is the declination of the sun, and we need to convert it into 
            // an inclination
            polarAngle = (Math.PI/2) - declinationOfSun 

            r = 1 // how far is the sun from the center of the earth

            x = r * Math.sin(polarAngle) * Math.cos(azimuthAngle);
            y = r * Math.sin(polarAngle) * Math.sin(azimuthAngle);
            z = r * Math.cos(polarAngle);

            return { x: x, y: y, z: z};
        }

        function buildSatellites(scene, sat_tles) {
            var satellite_width_km = 150
            var geometry = new THREE.SphereGeometry(satellite_width_km/scale, 32, 32);

            var satellites = []
            for (var i = 0; i < sat_tles.length; i++) {
                var pivot = new THREE.Object3D();
                scene.add(pivot);

                var mesh = new THREE.Mesh(
                    geometry,
                    new THREE.MeshBasicMaterial({ color: 0x000000})
                );

                pivot.add(mesh);

                satellites[i] = {
                    scene_object: mesh,
                    sat_id:       sat_tles[i]["sat_id"],
                    name:         sat_tles[i]["name"],
                    tle_line_1:   sat_tles[i]["line1"],
                    tle_line_2:   sat_tles[i]["line2"]
                };
            }
            return satellites;
        }
    }

function SatColors(){
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
        brown,        
        grey,         
        darker_purple,
        white,        
    ]

    this.colorIndex = 0
}

SatColors.prototype.next = function(){
    var color = this.colors[this.colorIndex]
    if (this.colorIndex >= this.colors.length - 1) {
        this.colorIndex = 0
    } else {
        this.colorIndex = this.colorIndex + 1
    }
    return color
}

}());