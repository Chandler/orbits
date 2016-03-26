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

(function () {
    $.ajax({
      dataType: "json",
      url: "generated_data/tles_and_tags.json",
      success: function(sat_data) {
        var tles = sat_data["tles"]
        var tags = sat_data["tags"]
        runApp(tles, tags)
      },
      error: function(error) {
        console.log(error)
      }
    })

    function runApp(tles, tags) {
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
        renderer.setSize(width, height);

        var camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
        camera.position.z = 3; //position camera above north pole
        camera.position.y = 0;
        camera.position.x = 0;
        camera.rotation.order = 'YXZ'
        
        // create ambient and directional lighting
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

        // ----> Stars make it harder to see high orbit satellites, rm them
        // var stars = new THREE.Mesh(
        //     new THREE.SphereGeometry(radius*10, segments, segments), 
        //     new THREE.MeshBasicMaterial({
        //         map:  THREE.ImageUtils.loadTexture('images/galaxy_starfield.png'), 
        //         side: THREE.BackSide
        //     })
        // );
        // scene.add(stars);

        satellites = buildSatellites(scene, tles)

        // controls update camera position based on mouse dragging
        var controls = new THREE.TrackballControls(camera);
        webglEl.appendChild(renderer.domElement);
        render();

        // these two variables are used for the two pieces of global state, 
        // because they have to be accessed by the onclicks and the nextdate() 
        // function and I haven't totally figured out the right way to do that yet
        var secondsPastCurrentTime = 0    
        var speedupMultiplier = 100
        var resetAfterThisManySeconds = 86400

        // Main animation loop
        function render() {
            controls.update();
            var date = nextDate();

            updateSatellites(filterSatellites(satellites), date);
            updateSun(light, date)
            if (!isNaN(date)) {
                $(".time").text(dateFormat(date, "mmmm dS, yyyy, h:MM TT", true) + " UTC");    
            }
            requestAnimationFrame(render);
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

        // var data = [
        //     {
        //         id: '',
        //         text: 'Citrus',
        //         children: [
        //             { id: 'c1', text: 'Grapefruit' },
        //             { id: 'c2', text: 'Orange' },
        //             { id: 'c3', text: 'Lemon' },
        //             { id: 'c4', text: 'Lime' }
        //         ]
        //     },
        //     {
        //         id: '',
        //         text: 'Other',
        //         children: [
        //             { id: 'o1', text: 'Apple' },
        //             { id: 'o2', text: 'Mango' },
        //             { id: 'o3', text: 'Banana' }
        //         ]
        //     }
        // ];

        $("#tag-selector").select2({
          data: keys(tags),
          multiple: true
        })



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

        function filterSatellites(satellites) {
            return satellites
        }

        function updateSatellites(satellites, date) {
            for (var i = 0; i < satellites.length; i++) {
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
                    new THREE.MeshBasicMaterial({ color: satColors(sat_tles[i]["name"])})
                );

                pivot.add(mesh);

                satellites[i] = {
                    scene_object: mesh,
                    name: sat_tles[i]["name"],
                    tle_line_1: sat_tles[i]["line1"],
                    tle_line_2: sat_tles[i]["line2"]
                };
            }
            return satellites;
        }

        function satColors(name) {
            if (name.includes("1C")) {
                return 0xB54BC1; //purple
            } else if (name.includes("1E")) {    
                return 0x96D811; //green
            } else if (name.includes("ISS")) {
                return 0xFF0000; //red
            } else if (name.includes("Hubble")) {
                return 0x0089FF; //blue
            } else if (name.includes("Lemur")) {
                return 0x13E2EC; //cyan
            } else {
                return 0xffffff
            }
        }
    }
}());