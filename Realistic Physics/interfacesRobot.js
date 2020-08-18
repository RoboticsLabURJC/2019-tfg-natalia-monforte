import {sleep} from '../utils';
import {simEnabled} from '../globals';
import {tickCounter} from '../globals';
import {getTickCounter} from '../globals';
import {setTickCounter} from '../globals';
import {getBrainStatus} from '../../brains/brains-methods';

export class RobotI {

    constructor(robotId) {
        const defaultDistanceDetection = 10;
        const defaultNumOfRays = 31;

        /* Variables para el motor de físicas realistas */
        this.errorY = 0;
        this.errorXZ = 0;
        this.errorW = 0;
        this.errorActualY = 0;
        this.errorActualXZ = 0;
        this.errorActualW = 0;
        this.derivadaErrorY = 0;
        this.derivadaErrorXZ = 0;
        this.derivadaErrorW = 0;
        this.forcePD = 0;
        this.accelerationPD = 0;
        this.commandedVelocityY = 0;
        this.commandedVelocityXZ = 0;
        this.commandedVelocityW = 0;
        this.accelerationPDY = 0;
        this.accelerationPDXZ = 0;
        this.accelerationPDW = 0;
        this.resultVelocity = 0;
        this.refPos = 0;
        this.stop = true;
        this.motorIterations = 0;

        this.myRobotID = robotId;
        this.robot = document.getElementById(robotId);
        this.activeRays = false;
        this.camerasData = [];
        this.raycastersArray = [];
        this.distanceArray = {
            center: [],
            left: [],
            right: []
        };
        this.understandedColors = {
            blue: {low: [0, 0, 235, 0], high: [0, 0, 255, 255]},
            green: {low: [0, 235, 0, 0], high: [0, 255, 0, 255]},
            red: {low: [110, 0, 0, 0], high: [255, 30, 30, 255]},
            white: {low: [230, 230, 230, 0], high: [255, 255, 255, 255]},
            black: {low: [0, 0, 0, 255], high: [105, 105, 105, 255]}
        };
        this.velocity = {x: 0, y: 0, z: 0, ax: 0, ay: 0, az: 0};

        this.findCameras();
        this.motorsStarter();
        this.startCamera();
        this.startRaycasters(defaultDistanceDetection, defaultNumOfRays);
        var robotEvent = new CustomEvent('robot-loaded', {
            'detail': this
        });
        document.dispatchEvent(robotEvent);
    }

    getID() {
        return this.myRobotID;
    }

    findCameras() {
        /**
         * This function searchs for camera entities that has robotID
         * contained in cameraID which means the camera belongs to
         * the body of the robot (attached). This ID is stored in an array
         * with the camera wrapper id that must be same as cameraID + 'Wrapper'
         *
         */
        var sceneCameras = document.getElementsByTagName('a-camera');
        for (var i = 0; i < sceneCameras.length; i++) {
            var cameraID = sceneCameras[i].getAttribute('id');
            if (cameraID.includes(this.myRobotID)) {
                this.camerasData.push(
                    {
                        'wrapperID': cameraID + 'Wrapper',
                        'cameraID': cameraID,
                        'canvasID': cameraID + 'Canvas'
                    })
            }
        }
    }

    motorsStarter() {
        /*
          This function starts motors
        */

        console.log("LOG ---------------- Setting up motors.")
        this.setVelocity();
        this.auxiliaryPhysics();
    }

    getRotation() {
        /*
          Returns an object with rotation properties.
        */
        return this.robot.getAttribute('rotation');
    }

    setV(v) {
        this.velocity.x = v;
    }

    setW(w) {
        this.velocity.ay = w * 10;
    }

    setL(l) {
        this.velocity.y = l;
    }

    move(v, w, h) {
        this.setV(v);
        this.setW(w);
        this.setL(h);
    }

    advance(linearSpeed) {
        this.setV(linearSpeed);
    }


    async advanceTo(distance) {
        var brainStatus = getBrainStatus(this.myRobotID);
        brainStatus.blocking_instruction = true;
        let initial_position_x = this.getPosition().x;
        let initial_position_z = this.getPosition().z;
        distance > 0 ? this.setV(1) : this.setV(-1);
        while (getBrainStatus(this.myRobotID).status !== "RELOADING" && Math.sqrt(Math.pow(initial_position_x - this.getPosition().x, 2)
            + Math.pow(initial_position_z - this.getPosition().z, 2)) <= Math.abs(distance)) {
            await sleep(0.01);
        }
        brainStatus.blocking_instruction = false;
        this.setV(0);
    }

    async upTo(distance) {
        let initial_position = this.getPosition().y;
        this.setL(1);
        while (getBrainStatus(this.myRobotID).status !== "RELOADING" && Math.abs(initial_position - this.getPosition().y) <= Math.abs(distance)) {
            await sleep(0.01);
        }
        this.setL(0);
    }

    async downTo(distance) {
        let initial_position = this.getPosition().y;
        this.setL(-1);
        while (getBrainStatus(this.myRobotID).status !== "RELOADING" && Math.abs(initial_position - this.getPosition().y) <= Math.abs(distance)) {
            await sleep(0.01);
        }
        this.setL(0);
    }

    async turnUpTo(angle) {
        var brainStatus = getBrainStatus(this.myRobotID);
        brainStatus.blocking_instruction = true;
        let initial_position = this.getPosition().theta + 180.0; // [0, 360]
        angle > 0 ? this.setW(-0.15) : this.setW(0.15);
        var current_position = this.getPosition().theta + 180.0; // [0, 360]
        if (initial_position - angle < 0.0) {
            angle = angle - 360.0; // discontinuity
        }
        while (getBrainStatus(this.myRobotID).status !== "RELOADING" && Math.abs(current_position - ((initial_position - angle) % 360.0)) >= 5.0) {
            await sleep(0.0001);
            current_position = this.getPosition().theta + 180.0; // [0, 360]
        }
        brainStatus.blocking_instruction = false;
        this.setW(0);
    }

    async land() {
        var brainStatus = getBrainStatus(this.myRobotID);
        brainStatus.blocking_instruction = true;
        let position = this.getPosition();
        if (position.y > 2) {
            while (getBrainStatus(this.myRobotID).status !== "RELOADING" && this.getPosition().y > 2) {
                this.setL(-2);
                await sleep(0.2);
            }
            this.setL(0);
        }
        brainStatus.blocking_instruction = false;
    }

    async takeOff() {
        var brainStatus = getBrainStatus(this.myRobotID);
        brainStatus.blocking_instruction = true;
        let position = this.getPosition();
        if (position.y < 10) {
            while (getBrainStatus(this.myRobotID).status !== "RELOADING" && this.getPosition().y < 10) {
                this.setL(2);
                await sleep(0.2);
            }
            this.setL(0);
        }
        brainStatus.blocking_instruction = false;
    }

    getV() {
        return this.velocity.x;
    }

    getW() {
        return this.velocity.ay;
    }

    getL() {
        return this.velocity.y;
    }

    auxiliaryPhysics() {
            /* Actualización de iteraciones de CANNON */

            this.motorIterations = getTickCounter();

            /* Y AXIS  -> ONLY FOR DRONE */
            if ((this.velocity.y <= 0.0001) || (this.velocity.y <= -0.0001)){
                if (this.stop == true) {
                    this.refPos = this.robot.body.position.y;
                }
                this.stop = false;
                this.accelerationPDY = this.controladorPDVerticalPos();
            } else {
                this.stop = true;
                this.accelerationPDY = this.controladorPDVerticalVel();
            }
            this.commandedVelocityY = this.robot.body.velocity.y + this.motorIterations*this.accelerationPDY;
            this.robot.body.velocity.set(this.robot.body.velocity.x, this.commandedVelocityY, this.robot.body.velocity.z);


            /* Horizontal plane */

            let rotation = this.getRotation();
            if (Math.abs(rotation.y) >= 0.0001 || Math.abs(rotation.y) <= 0.0001 || Math.abs(rotation.y) >= 180.0001 || Math.abs(rotation.y) <= 180.0001  || Math.abs(rotation.y) >= 360.0001 || Math.abs(rotation.y) <= 360.0001) {
                this.resultVelocity = this.robot.body.velocity.x;
            } else if (Math.abs(rotation.y) >= 90.0001 || Math.abs(rotation.y) <= 90.0001  || Math.abs(rotation.y) >= 270.0001 || Math.abs(rotation.y) <= 270.0001) {
                this.resultVelocity = this.robot.body.velocity.z;
            } else {
                this.resultVelocity = this.robot.body.velocity.x / Math.cos(rotation.y * Math.PI / 180) + this.robot.body.velocity.z  / Math.sin(-rotation.y * Math.PI / 180);
            }
            this.resultVelocity = Math.sqrt(Math.pow(this.robot.body.velocity.x, 2) + Math.pow(this.robot.body.velocity.z, 2));

            this.accelerationPDXZ = this.controladorPDHorizontal(this.resultVelocity);
            this.commandedVelocityXZ = this.resultVelocity + this.motorIterations*this.accelerationPDXZ;
            //console.log("Velocidad comandada:" + this.commandedVelocityXZ);
            this.robot.body.velocity.set(this.commandedVelocityXZ * Math.cos(rotation.y * Math.PI / 180), this.robot.body.velocity.y, this.commandedVelocityXZ * Math.sin(-rotation.y * Math.PI / 180));


            /* Angular movement */
            this.accelerationPDW = this.controladorPDAngular();
            this.commandedVelocityW = this.robot.body.angularVelocity.y + this.motorIterations*this.accelerationPDW;
            this.robot.body.angularVelocity.set(0, this.commandedVelocityW, 0);

            /* Actualización de iteraciones de CANNON */
            setTickCounter(0);

        setTimeout(this.auxiliaryPhysics.bind(this), 20);
    }

    controladorPDVerticalVel() {
        const mass = this.robot.body.mass;
        const kp = 0.45*mass;
        const kd = 0.12*mass;
        const fMax = 1000000;
        const accelerationMax = fMax / mass;

        this.errorActualY = this.velocity.y - this.robot.body.velocity.y; // Si todavía no he alcanzado el objetivo, será negativo
        this.derivadaErrorY = this.errorActualY - this.errorY;
        this.errorY = this.errorActualY;
        this.forcePD = kp*this.errorActualY + kd*this.derivadaErrorY;
        this.accelerationPD = this.forcePD / mass;

        if (this.accelerationPD > this.accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
        return this.accelerationPD;
    }

    controladorPDVerticalPos() {
        const mass = this.robot.body.mass;
        const kp = 0.95*mass;
        const kd = 0.95*mass;
        const fMax = 1000000;
        const accelerationMax = fMax / mass;

        this.errorActualY = this.refPos - this.robot.body.position.y;
        this.derivadaErrorY = this.errorActualY - this.errorY;
        this.errorY = this.errorActualY;
        this.forcePD = kp*this.errorActualY + kd*this.derivadaErrorY;
        this.accelerationPD = this.forcePD / mass;

        if (this.accelerationPD > this.accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
        return this.accelerationPD;
    }

    controladorPDHorizontal(resultVelocity) {
        const mass = this.robot.body.mass;
        const kp = 0.45*mass;
        const kd = 0.01*mass;
        const fMax = 1000000;
        const accelerationMax = fMax / mass;

        this.errorActualXZ = this.velocity.x - resultVelocity;
        this.derivadaErrorXZ = this.errorActualXZ - this.errorXZ;
        this.errorXZ = this.errorActualXZ;

        this.forcePD = kp*this.errorActualXZ + kd*this.derivadaErrorXZ;
        this.accelerationPD = this.forcePD / mass;

        if (this.accelerationPD > this.accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
        return this.accelerationPD;
    }

    controladorPDAngular() {
        const mass = this.robot.body.mass;
        const kp = 0.6*mass;
        const kd = 0.12*mass;
        const inertia = this.robot.body.inertia.x;
        const tMax = 1000000;
        const angularAccelerationMax = tMax / inertia;

        this.errorActualW = this.velocity.ay - this.robot.body.angularVelocity.y; // Si todavía no he alcanzado el objetivo, será negativo
        this.derivadaErrorW = Math.abs(this.errorW - this.errorActualW);
        this.errorW = this.errorActualW;

        this.forcePD = kp*this.errorActualW + kd*this.derivadaErrorW;
        this.accelerationPD = this.forcePD / inertia;

        if (this.accelerationPD > this.accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
        return this.accelerationPD;
    }

    setVelocity() {
        /*
          This code run continiously, setting the speed of the robot every 30ms
          This function will not be callable, use setV, setW or setL
        */
       var robot;
        if (this.robot.body.position.y > 1) { //to activate animation of drone
            robot = document.querySelector("#" + this.myRobotID);
            robot.setAttribute('animation-mixer', "clip:*;timeScale:1.5");
        } else {
            robot = document.querySelector("#" + this.myRobotID);
            robot.setAttribute('animation-mixer', "clip:None");
        }
        //let rotation = this.getRotation();
        //let newpos = this.updatePosition(rotation, this.velocity, this.robot.body.position);
        //this.robot.body.position.set(newpos.x, newpos.y, newpos.z);
        //this.robot.body.angularVelocity.set(this.velocity.ax, this.velocity.ay, this.velocity.az);

        this.timeoutMotors = setTimeout(this.setVelocity.bind(this), 50);
    }

    updatePosition(rotation, velocity, robotPos) {
        if(simEnabled){
            let x = velocity.x / 10 * Math.cos(rotation.y * Math.PI / 180);
            let z = velocity.x / 10 * Math.sin(-rotation.y * Math.PI / 180);
            let y = (velocity.y / 10);
            robotPos.x += x;
            robotPos.z += z;
            robotPos.y += y;
        }
        return robotPos;
    }

    getCameraDescription() {
        /*
          Returns width and height for the robot camera.
        */
        return {width: this.canvas2d.width, height: this.canvas2d.height};
    }

    getImageDescription() {
        /*
          Returns an object with width and height of the robot image.
        */
        return {width: this.imagedata.cols, height: this.imagedata.rows};
    }

    startCamera() {
        // Starts camera from robot
        console.log("LOG ---------> Starting camera.");
        if (($('#spectatorDiv').length) && (document.querySelector("#spectatorDiv").firstChild != undefined)) {
            for (var i = 0; i < this.camerasData.length; i++) {
                var canvasID = '#' + this.camerasData[i]['canvasID'];
                this.canvas2d = document.querySelector(canvasID);
                this.camerasData[i]['canvasElement'];
            }
            this.getImageData_async();
        } else {
            setTimeout(this.startCamera.bind(this), 100);
        }
    }

    /*toggleCamera(){
      var availableCameras = this.camerasData.length;
      if (this.activeCamera + 1 + 1 <= availableCameras) {
        this.activeCamera += 1;
      } else {
        this.activeCamera = 0;
      }
      console.log(this.activeCamera);
    }*/

    getImage(cameraID) {
        /**
         * Returns a screenshot from the robot camera
         */
        /*for(var i = 0; i <= this.camerasData.length; i++){
            console.log(this.camerasData[i]);

        }*/
        if (!cameraID || (this.camerasData.length === 1) || (cameraID > this.camerasData.length - 1)) {
            // Robots with one camera get the only one available
            // Requests for cameras that don't exist returns default camera
            return this.camerasData[0]['image'];

        } else {
            // Robots with two or more cameras
            return this.camerasData[cameraID]['image'];
        }

    }

    getImageData_async(cameraID) {
        /*
          This function stores image from the robot in the variable
          "imagedata", this allows to obtain image from the robot
          with getImage() function.
        */
        if (simEnabled) {
            for (var i = 0; i < this.camerasData.length; i++) {
                this.camerasData[i]['image'] = cv.imread(this.camerasData[i]['canvasID']);
            }
        }
        this.timeoutCamera = setTimeout(this.getImageData_async.bind(this), 60);
    }

    startRaycasters(distance, numOfRaycasters) {
        /*
          This function enables/disbles raycasters (position sensors)
          for the robot.

          @distance (Number): Distance which the rays will detect objects.
          @numOfRaycasters (Numbrer): Number of Raycaster.
        */
        if (!this.activeRays) {
            console.log("LOG ---------> Starting sound sensors");
            let emptyEntity = document.querySelector("a-scene");
            // offsetAngle: angle between one raycaster and the next one.
            if ((numOfRaycasters % 2) == 0) {
                numOfRaycasters += 1;
            }
            var offsetAngle = 180 / numOfRaycasters;
            var angle = -90;
            for (var i = 0; i < numOfRaycasters; i++) {
                if (i == (numOfRaycasters - 1) / 2) {
                    angle += offsetAngle;
                    var group = "center";
                } else if (i < (numOfRaycasters - 1) / 2) {
                    angle = angle * 1;
                    angle += offsetAngle;
                    group = "left";
                } else if (i > (numOfRaycasters - 1) / 2) {
                    angle = angle * 1;
                    angle += offsetAngle;
                    group = "right";
                }
                this.createRaycaster(distance, angle, emptyEntity, group, i);
            }
            this.activeRays = true;
            this.setListener();
        } else {
            this.stopRaycasters();
        }
    }

    createRaycaster(distance, angle, emptyEntity, group, number) {
        /*
          This function appends raycasters entities to the robot.
        */
        let newRaycaster = document.createElement('a-entity');
        newRaycaster.setAttribute('raycaster', 'objects', '.collidable');
        newRaycaster.setAttribute('raycaster', 'far', distance);
        newRaycaster.setAttribute('raycaster', 'showLine', true);
        newRaycaster.setAttribute('raycaster', 'direction', "1 0 0");
        newRaycaster.setAttribute('raycaster', 'interval', 100);
        newRaycaster.setAttribute('raycaster', 'enabled', true);
        newRaycaster.setAttribute('line', 'color', "#ffffff");
        newRaycaster.setAttribute('line', 'opacity', 1);
        newRaycaster.setAttribute('line', 'end', "1 0 0");
        newRaycaster.setAttribute('follow-body', 'entityId', '#' + this.myRobotID);
        newRaycaster.setAttribute('follow-body', "offsetRotation", "0 " + angle + " 0");
        newRaycaster.setAttribute('intersection-handler', 'fps', '10');
        newRaycaster.classList.add(group);
        newRaycaster.id = number.toString();
        this.raycastersArray.push(newRaycaster)
        emptyEntity.appendChild(newRaycaster);
    }

    stopRaycasters() {
        /*
          This function erases all raycasters for the robot.
        */
        var emptyEntity = document.querySelector("#positionSensor");
        while (emptyEntity.firstChild) {
            this.removeListeners(emptyEntity.firstChild);
            emptyEntity.removeChild(emptyEntity.firstChild);
        }
        this.activeRays = false;
        console.log("LOG ---------> Stopping sound sensors");
    }

    setListener() {
        /*
          This function sets up intersection listeners for each raycaster.
        */
        for (var i = 0; i < this.raycastersArray.length; i++) {
            this.raycastersArray[i].addEventListener('intersection-detected-' + this.raycastersArray[i].id,
                this.updateDistance.bind(this));

            this.raycastersArray[i].addEventListener('intersection-cleared-' + this.raycastersArray[i].id,
                this.eraseDistance.bind(this));
        }
    }

    removeListeners(raycaster) {
        /*
          This function disables intersection listeners.
        */
        raycaster.removeEventListener('intersection-detected-' + raycaster.id, () => {
            console.log("removed");
        });
        raycaster.removeEventListener('intersection-cleared-' + raycaster.id, () => {
            console.log("removed");
        });
    }

    updateDistance(evt) {
        /*
          This function is called when an intersection is detected and updates the distance
          to the point of intersection.
        */
        let id = evt.target.id;
        let targetClass = evt.target.classList[0];

        if (this.distanceArray[targetClass].length === 0) {

            this.distanceArray[targetClass].push({id: id, d: evt.detail});
        } else {
            let found = false;
            let j = 0;
            while ((j < this.distanceArray[targetClass].length) && !found) {
                if (this.distanceArray[targetClass][j].id === id) {
                    this.distanceArray[targetClass][j].d = evt.detail;
                    found = true;
                }
                j += 1;
            }
            if (!found) {
                this.distanceArray[targetClass].push({id: id, d: evt.detail});
            }
        }
    }

    eraseDistance(evt) {
        /*
          This function is called when the intersection is cleared and
          removes the distance from the array.
        */
        let id = evt.target.id;
        let targetClass = evt.target.classList[0];

        for (var i = 0; i < this.distanceArray[targetClass].length; i++) {
            if (this.distanceArray[targetClass][i].id == id) {
                this.distanceArray[targetClass].splice(i, 1);
            }
        }
    }


    getDistance() {
        /*
          This function returns the distance for the raycaster in the center of the arc of rays.
        */

        var distances = this.getDistances();

        if (distances[13] !== 10 || distances[14] !== 10 || distances[15] !== 10 || distances[16] !== 10 || distances[17] !== 10) {
            let distance0 = 100;
            let distance1 = 100;
            let distance2 = 100;
            let distance3 = 100;
            let distance4 = 100;
            if (distances[13] !== 10) {
                distance0 = distances[13];
            }
            if (distances[14] !== 10) {
                distance1 = distances[14];
            }
            if (distances[15] !== 10) {
                distance2 = distances[15];
            }
            if (distances[16] !== 10) {
                distance3 = distances[16];
            }
            if (distances[17] !== 10) {
                distance4 = distances[17];
            }
            let min_distances = [distance0, distance1, distance2, distance3, distance4];
            Array.min = function(array) {
                return Math.min.apply(Math, array);
            };
            return Array.min(min_distances);
        } else {
            return 10;
        }
    }

    getDistances() {
        /*
          This function returns an array with all the distances detected by the rays.
        */
        var distances = [];
        for (var i = 0; i <= 31; i++) {
            distances.push(10);
        }
        var groups = ["center", "right", "left"];
        for (i = 0; i < groups.length; i++) {
            this.distanceArray[groups[i]].forEach((obj) => {
                if (typeof obj.d != "undefined") {
                    distances[obj.id] = obj.d;
                }
            });
        }
        return distances;
    }

    getPosition() {
        /*
          This function returns an object with X-Y-Z positions and rotation (theta)
          for the Y axis.
        */
        let x = this.robot.object3D.position.x;
        let y = this.robot.object3D.position.y;
        let z = this.robot.object3D.position.z;
        let rot = THREE.Math.radToDeg(this.robot.object3D.rotation.y);

        return {x: x, y: y, z: z, theta: rot};
    }

    getPositionValue(position) {
        let position_value = this.getPosition();
        if (position === 'POSX') {
            return position_value.x;
        } else if (position === 'POSY') {
            return position_value.z;
        } else if (position === 'POSZ') {
            return position_value.y;
        } else {
            return position_value.theta;
        }
    }

    getColoredObject(colorAsString) {
    /*
      This function filters an object in the scene with a given color passed as string, uses OpenCVjs
      to filter by color and calculates the center of the object and the area.

      Returns center: CenterX (cx), CenterY (cy) and the area of the object detected in the image.
    */
        var image = this.getImage();
        var colorCodes = this.getColorCode(colorAsString);
        var binImg = new cv.Mat();
        var M = cv.Mat.ones(5, 5, cv.CV_8U);
        var anchor = new cv.Point(-1, -1);
        var lowThresh = new cv.Mat(image.rows, image.cols, image.type(), colorCodes[0]);
        var highThresh = new cv.Mat(image.rows, image.cols, image.type(), colorCodes[1]);
        var contours = new cv.MatVector();
        var hierarchy = new cv.Mat();

        cv.morphologyEx(image, image, cv.MORPH_OPEN, M, anchor, 2,
            cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue()); // Erosion followed by dilation

        cv.inRange(image, lowThresh, highThresh, binImg);
        cv.findContours(binImg, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

        var contoursDict = {};
        var contoursArray = [];
        var nareas = 0;
        for (let i = 0; i < contours.size(); ++i) {
            let p1 = new cv.Point(0,0);
            let p2 = new cv.Point(0,0);
            var dict = {}

            if (contours.size() > 0) {
                nareas++;
                let stored = contours.get(i);
                var objArea = cv.contourArea(stored, false);

                let moments = cv.moments(stored, false);
                var cx = moments.m10 / moments.m00;
                var cy = moments.m01 / moments.m00;

                let square = cv.boundingRect(stored);

                p1 = new cv.Point(square.x, square.y);
                p2 = new cv.Point(square.x+square.width, square.y+square.height);

                dict = {center: [parseInt(cx), parseInt(cy)], area: parseInt(objArea), corner1: [parseInt(p1.x), parseInt(p1.y)], corner2: [parseInt(p2.x), parseInt(p2.y)]};
                contoursArray.push(dict);
            }
        }

        contoursDict["areas"] = nareas;
        contoursDict["details"] = contoursArray;
        //cv.imshow('outputCanvas', binImg);
        return contoursDict;
    }

    getObjectColorRGB(lowval, highval) {
        /*
          This function filters an object in the scene with a given color, uses OpenCVjs to filter
          by color and calculates the center of the object.

          Returns center: CenterX (cx), CenterY (cy) and the area of the object detected in the image.
        */

        if (lowval.length == 3) {
            lowval.push(0);
        }
        if (highval.length == 3) {
            highval.push(255);
        }
        var image = this.getImage();
        var binImg = new cv.Mat();
        var M = cv.Mat.ones(5, 5, cv.CV_8U);
        var anchor = new cv.Point(-1, -1);
        var lowThresh = new cv.Mat(image.rows, image.cols, image.type(), lowval);
        var highThresh = new cv.Mat(image.rows, image.cols, image.type(), highval);
        var contours = new cv.MatVector();
        var hierarchy = new cv.Mat();

        cv.morphologyEx(image, image, cv.MORPH_OPEN, M, anchor, 2,
            cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue()); // Erosion followed by dilation

        cv.inRange(image, lowThresh, highThresh, binImg);
        cv.findContours(binImg, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
        if (contours.size() > 0) {

            let stored = contours.get(0);
            var objArea = cv.contourArea(stored, false);

            let moments = cv.moments(stored, false);
            var cx = moments.m10 / moments.m00;
            var cy = moments.m01 / moments.m00;

        }
        return {center: [parseInt(cx), parseInt(cy)], area: parseInt(objArea)};
    }

    //getObjectColorPosition(color) {
        //let image = this.getObjectColor(color);
        //if (position === 'X') {
        //    return image.center[0];
        //} else if (position === 'Y') {
        //    return image.center[1];
        //} else {
        //    return image.area;
        //}
        //return image.area
    //}

    getObjectColorPositionRGB(position, valuemin, valuemax) {
        let image = this.getObjectColorRGB(valuemin, valuemax);
        if (position === 'X') {
            return image.center[0];
        } else if (position === 'Y') {
            return image.center[1];
        } else {
            return image.area;
        }
    }

    getColorCode(color) {
        /*
          This function returns binary values for the color if the color is on the
          array of colors that robot can filter.
        */
        if (this.understandedColors[color]) {
            var low = this.understandedColors[color].low;
            var high = this.understandedColors[color].high;
            return [low, high];
        }
    }

    followLine(lowval, highval, speed) {
        /*
          This function is a simple implementation of follow line algorithm, the robot filters an object with
          a given color and follows it.
        */
        if (simEnabled) {
            var data = this.getObjectColorRGB(lowval, highval); // Filters image

            this.setV(speed);

            if (data.center[0] >= 75 && data.center[0] < 95) {
                this.setW(-0.2);
            } else if (data.center[0] <= 75 && data.center[0] >= 55) {
                this.setW(0.2);
            } else if (data.center[0] >= 95) {
                this.setW(-0.35);
            } else if (data.center[0] <= 55) {
                this.setW(0.35)
            }
        }
    }

    readIR(reqColor) {
        /*
          This function filters an object on the robot image and returns 0-1-2-3 depending of the
          position of the center on X axis for the detected object.
        */
        var outputVal = 3;
        var image = this.getImage("camera-IR");
        var binImg = new cv.Mat();
        var colorCodes = this.getColorCode("black");
        var contours = new cv.MatVector();
        var hierarchy = new cv.Mat();
        let dst = new cv.Mat();
        let M = cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, 0, 0, 1, -95]);
        let dsize = new cv.Size(image.cols, image.rows - 95);
        // You can try more different parameters
        cv.warpAffine(image, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        var lowTresh = new cv.Mat(dst.rows, dst.cols, dst.type(), colorCodes[0]);
        var highTresh = new cv.Mat(dst.rows, dst.cols, dst.type(), colorCodes[1]);

        cv.inRange(dst, lowTresh, highTresh, binImg);
        cv.findContours(binImg, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);

        if (contours.size() > 0) {
            let stored = contours.get(0);
            let moments = cv.moments(stored, false);

            var cx = moments.m10 / moments.m00;

            if (isNaN(cx)) {
                outputVal = 3;
            } else if ((cx <= 150) && (cx >= 85)) {
                outputVal = 2;
            } else if ((cx >= 0) && (cx <= 65)) {
                outputVal = 1;
            } else {
                outputVal = 0;
            }

        }
        return outputVal;
    }

    /*
      SPANISH API: This methods calls the same method in english
    */

    leerIRSigueLineas() {
        return this.readIR();
    }

    avanzar(linearSpeed) {
        this.advance(linearSpeed);
    }

    async avanzarHasta(distance) {
        await this.advanceTo(distance);
    }

    girar(turningSpeed) {
        return this.setW(turningSpeed);
    }

    async girarHasta(angle, status) {
        await this.turnUpTo(angle);
    }

    async subir(distance) {
        this.upTo(distance)
    }

    async bajar(distance) {
        this.downTo(distance);
    }

    async aterrizar() {
        this.land();
    }

    async despegar() {
        this.takeOff();
    }

    parar() {
        this.move(0, 0, 0);
    }

    leerUltrasonido() {
        return this.getDistance();
    }

    dameObjeto(lowFilter, highFilter) {
        return this.getObjectColorRGB(lowFilter, highFilter);
    }

    dameImagen() {
        return this.getImage();
    }
}
