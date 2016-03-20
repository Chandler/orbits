// huge thanks to Bjorn Sandvik's webgl earth tutorial
// http://blog.thematicmapping.org/2013/09/creating-webgl-earth-with-threejs.html
(function () {

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
    camera.position.z = 3;
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

    satellites = buildSatellites(scene, tles)

    // controls update camera position based on mouse dragging
    var controls = new THREE.TrackballControls(camera);
    webglEl.appendChild(renderer.domElement);
    render();

    // these two variables are used for the two pieces of global state, 
    // because they have to be accessed by the onclicks and the nextdate() 
    // function and I haven't totally figured out the right way to do that yet
    var secondsPastCurrentTime = 0    
    var fastFoward = true

    // Main animation loop
    function render() {
        controls.update();
        var date = nextDate()
        updateSatellites(satellites, date);
        updateSun(light, date)
        requestAnimationFrame(render);
        renderer.render(scene, camera);
    }

    $('#realtime').on('click', function () {
        fastFoward = false
        secondsPastCurrentTime = 0
    })

    $('#fast').on('click', function () {
        fastFoward = true
        secondsPastCurrentTime = 0
    })

    function nextDate() {
        if (fastFoward) {
            // only play forward 1 day then repeat
            if (secondsPastCurrentTime > 86400) {
                secondsPastCurrentTime = 0
            } else {
                secondsPastCurrentTime = secondsPastCurrentTime + 45
            }
        }
        
        var today = new Date();
        today.setSeconds(today.getSeconds() + secondsPastCurrentTime);
        return today;
    }

    function updateSun(light, date) {
        sunCoordinates = approximateSunPosition(date);
        // z doesn't matter, assuming sun is directly above equator
        light.position.set(sunCoordinates.x,sunCoordinates.y, 0);
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
        // what % of the day are we through
        // in terms of hours 1-24
        dayProgress = (date.getUTCHours())/24;

        // what percent of the hour are we through in terms
        // of minutes 1-60
        hourProgress = (date.getUTCMinutes()/60)*(1/24);

        // what percent of the day are we through, at minutly granularity
        preciseProgres = dayProgress + hourProgress;

        // the sun rotates east to west but our progress around the equator
        // goes west to east so we need to go backwards
        descendingProgress = 1-preciseProgres;

        //convert progress % to radians, 100% = 2pi
        progressToRadians = descendingProgress*2*3.14;

        // add one pi radians to convert from midnight to noon
        noonRadiansFromLongZero = progressToRadians + 3.14;

        //convert radians into xy points on the equator
        x = Math.cos(noonRadiansFromLongZero);
        y = Math.sin(noonRadiansFromLongZero);
        return { x: x, y: y };
    }

    function buildSatellites(scene, sat_tles) {
        var satellite_width_km = 100
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
                tle_line_1: sat_tles[i]["line_1"],
                tle_line_2: sat_tles[i]["line_2"]
            };
        }
        return satellites;
    }

    function satColors(name) {
        if (name.includes("1C")) {
            return 0xB54BC1 //purple //0xEC4513; //orange
        } else if (name.includes("1E")) {    
            return 0x96D811; //green
        } else if (name.includes("ISS")) {
            return 0xFF0000 //red
        } else {
            return 0x000000
        }
    }
}());