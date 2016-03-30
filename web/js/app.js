// huge thanks to Bjorn Sandvik's webgl earth tutorial
// http://blog.thematicmapping.org/2013/09/creating-webgl-earth-with-threejs.html

function Config(tles, tags) {
    // starting application state
    this.speedupMultiplier         = 1000
    // this.resetAfterThisManySeconds = 86400
    this.satelliteWidthKm          = 150
    // a scale factor to bring the earth's widths and satellite
    // coordinates down to values around 1
    this.scale                     = 10000
    this.selectedTags              = ["Cubesats"] //mut
    this.orbitConfig               = "one_orbit" //mut
    this.originalDate              = new Date();
    this.currentDate               = new Date(); //mut
    this.tles                      = tles
    this.tags                      = tags
    // how far our fake sun lightsource is from the center of the earth, in km
    // works just fine if it's actually inside the earth.
    this.distanceToSun             = 1
    // assuming 60 fps for now, you could calculate the actual fps
    // http://stackoverflow.com/a/5111475/67166 like this
    this.fps                       = 60
}

(function () {
    $.ajax({
      dataType: "json",
      url: "generated_data/tles_and_tags.json",
      success: function(sat_data) {
        var tles   = sat_data["tles"]
        var tags = sat_data["tags"]
        initializeAnimation(tles, tags)
      },
      error: function(error) {
        console.log(error)
      }
    })

    function initializeAnimation(tles, tags) {
        var webglEl = document.getElementById('scene');
        var width   = window.innerWidth;
        var height  = window.innerHeight;

        // this is mutable, the onclick handlers updates the values and the render()
        // function reads them before rendering each frame.
        var config = new Config(tles, tags)

        var earthRadiusKm = 6378.135 // width of the earth in kilometers

        var scene    = new THREE.Scene();
        var renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height)

        var camera            = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.z     = 3; //position camera above north pole
        camera.position.y     = 0;
        camera.position.x     = 0;
        camera.rotation.order = 'YXZ'
        
        scene.add(new THREE.AmbientLight(0x333333));
        var light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(10000/config.scale,10000/config.scale,10000/config.scale);
        scene.add(light);

        // create earth
        var radius   = earthRadiusKm/config.scale;
        var segments = 32 // how many polygons to use when rendering the earth sphere
        var sphere   = new THREE.Mesh(
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
        scene.add(new THREE.AxisHelper((earthRadiusKm*2)/config.scale));

        var satellites = buildSatellites(scene, tles, config)

        // controls update camera position based on mouse dragging
        var controls = new THREE.TrackballControls(camera);

        webglEl.appendChild(renderer.domElement);

        // setup on click input handlers
        $('#realtime').on('click', function () {
            config.currentDate = config.originalDate
            config.speedupMultiplier = 0
        })

        $('#100x').on('click', function () {
            config.speedupMultiplier = 100
            config.currentDate = config.originalDate
        })

        $('#1000x').on('click', function () {
            config.speedupMultiplier = 1000
            config.currentDate = config.originalDate
        })

        $('#orbits_off').on('click', function () {
            config.orbitConfig = "off"
        })

        $('#orbits_one_orbit').on('click', function () {
            config.orbitConfig = "one_orbit"
        })

        $('#orbits_one_day').on('click', function () {
            config.orbitConfig = "one_day"
        })

        $("#tag-selector").select2({
           data: keys(config.tags),
           multiple: true
        })

        // some crazy bug where this only works on the second try
        $("#tag-selector").select2().val(config.selectedTags)
        $("#tag-selector").select2().val(config.selectedTags)

        $("#tag-selector").on("select2:open", function (e) {
            $(".select2-results__options").niceScroll({
                cursorborder: 'none'
            })
        })

        $("#tag-selector").on("select2:select select2:unselect", function (e) {
            selected = $(this).val()
            if (selected != null) {
                config.selectedTags = selected
            } else {
                config.selectedTags = []
            }
        })

        // start render loop
        render(
            scene,
            light,
            satellites,
            config,
            controls,
            renderer,
            camera
        );
    }

    // animation loop
    function render(
        scene,
        light,
        satellites,
        config,
        controls,
        renderer,
        camera
    ) {
        controls.update()

        var offset =
            nextDateOffset(
                config.speedupMultiplier,
                config.fps
            )

        config.currentDate.setSeconds(config.currentDate.getSeconds() + offset)

        clearSatellites(satellites)

        var selectedSatellites = 
            getSelectedSatellites(
                config.selectedTags,
                config.tags,
                satellites
            )

        var colorMap = buildColorMap(selectedSatellites)

        updateLegend(selectedSatellites, colorMap)

        updateSatellites(
            selectedSatellites,
            config.currentDate,
            config.scale
        )
        
        updateSun(light, config.currentDate, config.distanceToSun)

        updateDateField(config.currentDate)

        updateOrbitRings(scene, selectedSatellites, colorMap, config)

        requestAnimationFrame(
            function() { render(
                scene,
                light,
                satellites, 
                config,
                controls,
                renderer,
                camera
            )}
        )
        renderer.render(scene, camera)
    }

    function updateDateField(date) {
        if (!isNaN(date)) {
            $(".time").text(dateFormat(date, "mmmm dS, yyyy, h:MM TT", true) + " UTC");    
        }
    }

    function nextDateOffset(speedupMultiplier, fps) {
        if (speedupMultiplier != 0) {
            return speedupMultiplier/fps
        } else {
            return 0
        }
    }

    function updateSun(light, date, distanceToSun) {
        sunCoordinates = sunPosition(date, distanceToSun);
        light.position.set(sunCoordinates.x,sunCoordinates.y, sunCoordinates.z);
    }

    function getSelectedSatellites(selectedTags, tags, satellites) {
        ids = []
        for (i = 0; i < selectedTags.length; i++) {
            ids = ids.concat(tags[selectedTags[i]])
        }

        var filtered = satellites.filter(function(sat) {
            return isInArray(sat.sat_id, ids)
        })

        function compare(a,b) {
          if (a.name < b.name)
            return -1;
          else if (a.name > b.name)
            return 1;
          else 
            return 0;
        }

        filtered.sort(compare);

        return filtered
    }

    function updateLegend(satellites, colorMap) {
        if (satellites.length <= 0) {
            $("#legend").text("")
        } else {
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
        }
    }

    function tleToPositionAndVelocity(line1, line2, date) {
        var satrec = satellite.twoline2satrec(line1, line2)
        var positionAndVelocity = satellite.propagate(
            satrec,
            date.getUTCFullYear(),
            date.getUTCMonth() + 1,
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds()
        )
        return positionAndVelocity
    }

    function tleToEcfCoordinates(line1, line2, date) {
        var gmst = satellite.gstimeFromDate(
            date.getUTCFullYear(),
            date.getUTCMonth() + 1, // Note, this function requires months in range 1-12.
            date.getUTCDate(),
            date.getUTCHours(),
            date.getUTCMinutes(),
            date.getUTCSeconds()
        );
        var positionAndVelocity = tleToPositionAndVelocity(line1, line2, date)
        
        // https://en.wikipedia.org/wiki/Earth-centered_inertial
        var positionEci = positionAndVelocity.position;

        // https://en.wikipedia.org/wiki/ECEF
        // ecef is the fixed earth coordinate system which is what we want
        // in this example since our earth doesn't rotate.
        // if earth was rotating instead of the sun we would need the ECI
        // coordinates I think
        var positionEcf = satellite.eciToEcf(positionEci, gmst);
        return positionEcf
    }

    function updateOrbitRings(scene, satellites, colorMap, config) {
        if (config.orbitConfig != "off") {
            for (var i = 0; i < satellites.length; i++) {
                if (config.orbitConfig == "one_orbit") {
                    var orbitLength = 3 //TODO calculate this for real
                } else if (config.orbitConfig == "one_day") {
                    var orbitLength = 24
                }
                var previousDate = config.currentDate
                var sat = satellites[i]   
                var splinepts = [];

                var resolution = 3
                var numPoints = ((orbitLength*60) * 0.95)/resolution
                var geometry = new THREE.Geometry()

                for (var j = 0; j < numPoints; j++) {
                    var date = diffMinutes(previousDate, -resolution)
                    var ecf = tleToEcfCoordinates(
                        sat["tle_line_1"],
                        sat["tle_line_2"],
                        date
                    )

                    geometry.vertices.push(
                        new THREE.Vector3(
                            ecf.x/config.scale,
                            ecf.y/config.scale,
                            ecf.z/config.scale
                        )
                    )
                    var previousDate = date
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

    function clearSatellites(satellites) {
        for (var i = 0; i < satellites.length; i++) {
            satellites[i]["scene_object"].visible = false
            if ("orbit_object" in satellites[i]) {
                satellites[i]["orbit_object"].visible = false 
            }
        }
    }

    function updateSatellites(satellites, date, scale) {
        for (var i = 0; i < satellites.length; i++) {
            satellites[i]["scene_object"].visible = true

            var ecfCoordinates = tleToEcfCoordinates(
                                    satellites[i]["tle_line_1"],
                                    satellites[i]["tle_line_2"],
                                    date
                                 )
            satellites[i]["scene_object"].position.x = ecfCoordinates.x/scale;
            satellites[i]["scene_object"].position.y = ecfCoordinates.y/scale;
            satellites[i]["scene_object"].position.z = ecfCoordinates.z/scale;
        }
    }

    function buildSatellites(scene, tles, config) {
        var geometry = new THREE.SphereGeometry(config.satelliteWidthKm/config.scale, 32, 32);

        var satellites = []
        for (var i = 0; i < tles.length; i++) {
            var tle = tles[i]
            var pivot = new THREE.Object3D();
            scene.add(pivot);

            var mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshBasicMaterial({color: 0x000000})
            );

            pivot.add(mesh);

            satellites[i] = {
                scene_object: mesh,
                sat_id:       tle["sat_id"],
                name:         tle["name"],
                tle_line_1:   tle["line1"],
                tle_line_2:   tle["line2"]
            };
        }
        return satellites;
    }
}());