/*
 * SOLAR DECLINATION
 * Follows the calculation of the declination of the sun, again you an use a table or a formula
 * "Table of the Declination of the Sun": http://www.wsanford.com/~wsanford/exo/sundials/DEC_Sun.html
 * Or use the following formula:
 * https://gist.github.com/jgomezdans/733741/0e14042e3f66b3d804c0a54cdb6df796c70aaf32
 */
function solarDeclination(dayOfYear, hourOfDay) {
    radians_progress_around_sun = ((2*Math.PI)/365.25)*(dayOfYear + hourOfDay/24)
    r = radians_progress_around_sun
    declination = 0.396372-22.91327*Math.cos(r)+4.02543*Math.sin(r)-0.387205*Math.cos(2*r) + 0.051967*Math.sin(2*r)-0.154527*Math.cos(3*r) + 0.084798*Math.sin(3*r)
    // somehow this magic function operates on radians and returns degress, 
    // convert back to rads
    return declination * (Math.PI/180); 
}

/*
 * return the XYZ position of a point that is `distance` kilometers between the
 * center of the earth and the position of the sun at `date`
 */
function sunPosition(date, distance) {
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

    r = distance

    x = r * Math.sin(polarAngle) * Math.cos(azimuthAngle);
    y = r * Math.sin(polarAngle) * Math.sin(azimuthAngle);
    z = r * Math.cos(polarAngle);

    return { x: x, y: y, z: z};
}
