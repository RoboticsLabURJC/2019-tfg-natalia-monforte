import {simEnabled} from '../globals';
import {tickCounter1, tickCounter2, getTickCounter, setTickCounter} from '../globals';
import {advance, advanceTo, setV, setW, setL, move, upTo, downTo, turnUpTo, land, takeOff, getV, getW, getL,
    getDistance, getDistances, readIR} from './robotAPI/HALRobotAPI'
import {getImage, getColoredObject, getObjectColorRGB, getObjectColorPositionRGB, getColorCode} from './robotAPI/visionRobotAPI'
import {printConsole, inputConsole} from './robotAPI/consoleRobotAPI'
import {sleep, getRobots} from './robotAPI/utilsRobotAPI'

export class RobotI {

    constructor(robotId) {
    
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
        this.init = true;
        this.stop = true;
        this.motorIterations = 0;
        
        const defaultDistanceDetection = 10;
        const defaultNumOfRays = 31;

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
            blue: {low: [0, 0, 100, 0], high: [0, 0, 255, 255]},
            green: {low: [0, 50, 0, 0], high: [0, 255, 0, 255]},
            red: {low: [110, 0, 0, 0], high: [255, 30, 30, 255]},
            white: {low: [230, 230, 230, 0], high: [255, 255, 255, 255]},
            black: {low: [0, 0, 0, 255], high: [105, 105, 105, 255]},
            yellow: {low: [110, 125, 0, 0], high: [255, 255, 0, 255]},
            orange: {low: [125, 100, 0, 0], high: [255, 175, 30, 255]},
            pink: {low: [175, 10, 50, 0], high: [255, 30, 157, 255]},
            purple: {low: [65, 0, 50, 0], high: [138, 0, 138, 255]},
            brown: {low: [40, 34, 31, 0], high: [112, 84, 61, 255]}
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
        /**
         * This function starts motors
         */

        console.log("Setting up motors.");
        this.setVelocity();
        this.auxiliaryPhysics();
    }

    getRotation() {
        return this.robot.getAttribute('rotation');
    }

    auxiliaryPhysics() {
	    var vmax = this.robot.getAttribute('vmax');
	    var wmax = this.robot.getAttribute('wmax');
	    
	   
	    if (this.robot.getAttribute('vmax') == null) {
	    	var vmax = 10;
	    }
	    
	    if (this.robot.getAttribute('wmax') == null) {
	    	var wmax = 5;
	    }
            
            /* Actualización de iteraciones de CANNON */

	   if (this.myRobotID == "a-car1") {
	   	this.motorIterations = getTickCounter(1);
	   } else if (this.myRobotID == "a-car2") {
	        this.motorIterations = getTickCounter(2);
	   }
           
            /* Y AXIS  -> ONLY FOR DRONE */
           
           if ((this.velocity.y <= 0.0001) || (this.velocity.y <= -0.0001)){
                if (this.init == true) {
                    this.accelerationPDY = 0;
                } else {
		     if (this.stop == true) {
		         this.refPos = this.robot.body.position.y;
		     }
		     this.stop = false;
		     this.accelerationPDY = this.controladorPDVerticalPos();
		 }
            } else {
                this.init = false;
                this.stop = true;
                this.accelerationPDY = this.controladorPDVerticalVel();
            }
            this.commandedVelocityY = this.robot.body.velocity.y + this.motorIterations*this.accelerationPDY;
            
	    if (Math.abs(this.commandedVelocityY) > vmax) {
            	if (this.commandedVelocityY > 0) {
            		this.commandedVelocityY = vmax;
            	} else {
            		this.commandedVelocityY = -vmax;
            	}
            }            
            this.robot.body.velocity.set(this.robot.body.velocity.x, this.commandedVelocityY, this.robot.body.velocity.z); 

            /* Horizontal plane */
     
	    let rotation = this.getRotation();
	    this.resultVelocity = Math.sqrt(Math.pow(this.robot.body.velocity.x, 2) + Math.pow(this.robot.body.velocity.z, 2));
	    this.accelerationPDXZ = this.controladorPDHorizontal(this.resultVelocity);
	    this.commandedVelocityXZ = this.resultVelocity + this.motorIterations*this.accelerationPDXZ;
	    
	    if (Math.abs(this.commandedVelocityXZ) > vmax) {
            	if (this.commandedVelocityXZ > 0) {
            		this.commandedVelocityXZ = vmax;
            	} else {
            		this.commandedVelocityXZ = -vmax;
            	}
            }
            this.robot.body.velocity.set(this.commandedVelocityXZ * Math.cos(rotation.y * Math.PI / 180), this.robot.body.velocity.y, this.commandedVelocityXZ * Math.sin(-rotation.y * Math.PI / 180));
	   
        /* Angular movement */                
        this.accelerationPDW = this.controladorPDAngular();
        this.commandedVelocityW = this.robot.body.angularVelocity.y + this.motorIterations*this.accelerationPDW;
        if (Math.abs(this.commandedVelocityW) > wmax) {
        	if (this.commandedVelocityW > 0) {
            		this.commandedVelocityW = wmax;
            	} else {
            		this.commandedVelocityW = -wmax;
            	}
            }  
        this.robot.body.angularVelocity.set(0, this.commandedVelocityW, 0);

        /* Actualización de iteraciones de CANNON */     	
        
        if (this.myRobotID == "a-car1") {
        	setTickCounter(0, 1);
	 } else if (this.myRobotID == "a-car2") {
	 	setTickCounter(0, 2);
         }
       
        setTimeout(this.auxiliaryPhysics.bind(this), 20);
    }

    controladorPDVerticalVel() {
        const kp = 0.45;
        const kd = 0.12;
        
        const mass = this.robot.body.mass;
        var fMax = this.robot.getAttribute('fmax');
        if (this.robot.getAttribute('fmax') == null) {
	    	var fMax = 10000000000000000000000000;
	}
        const accelerationMax = fMax / mass;

        this.errorActualY = this.velocity.y - this.robot.body.velocity.y; // Si todavía no he alcanzado el objetivo, será negativo
        this.derivadaErrorY = this.errorActualY - this.errorY;
        this.errorY = this.errorActualY;
        this.forcePD = kp*this.errorActualY + kd*this.derivadaErrorY;
        this.accelerationPD = this.forcePD / mass;

        if (this.accelerationPD > accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
        return this.accelerationPD;
    }

    controladorPDVerticalPos() {
        const kp = 0.95;
        const kd = 0.95;
        
        const mass = this.robot.body.mass;
        var fMax = this.robot.getAttribute('fmax');
        if (this.robot.getAttribute('fmax') == null) {
	    	var fMax = 10000000000000000000000000;
	}
        const accelerationMax = fMax / mass;

        this.errorActualY = this.refPos - this.robot.body.position.y;
        this.derivadaErrorY = this.errorActualY - this.errorY;
        this.errorY = this.errorActualY;
        this.forcePD = kp*this.errorActualY + kd*this.derivadaErrorY;
        this.accelerationPD = this.forcePD / mass;

        if (this.accelerationPD > accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
        return this.accelerationPD;
    }

    controladorPDHorizontal(resultVelocity) {
        const kp = 0.45;
        const kd = 0.01;
        
        const mass = this.robot.body.mass;
        var fMax = this.robot.getAttribute('fmax');
        if (this.robot.getAttribute('fmax') == null) {
	    	var fMax = 10000000000000000000000000;
	}
        const accelerationMax = fMax / mass;
        
        this.errorActualXZ = this.velocity.x - resultVelocity;
        this.derivadaErrorXZ = this.errorActualXZ - this.errorXZ;
        this.errorXZ = this.errorActualXZ;

        this.forcePD = kp*this.errorActualXZ + kd*this.derivadaErrorXZ;
        this.accelerationPD = this.forcePD / mass;

        if (this.accelerationPD > accelerationMax) {
            this.accelerationPD = accelerationMax;
        }
	  
        return this.accelerationPD;
    }

    controladorPDAngular() {
        const mass = this.robot.body.mass;
        
        if (this.init == false) {
	    var kp = 0.6;
	    var kd = 0.12;
	    var tMax = this.robot.getAttribute('tmax');
	    if (this.robot.getAttribute('tmax') == null) {
	    	var tMax = 100;
	    }
        } else {
	    var kp = 0.05;
	    var kd = 0.01;
	    var tMax = this.robot.getAttribute('tmax');
	    if (this.robot.getAttribute('tmax') == null) {
	    	var tMax = 100;
	    }
        }

	var inertia = this.robot.getAttribute('inertia');
        if (this.robot.getAttribute('inertia') == null) {
	    	var inertia = 1.33;
	 }
        
        const angularAccelerationMax = tMax / inertia;

        this.errorActualW = this.velocity.ay - this.robot.body.angularVelocity.y; 
        this.derivadaErrorW = Math.abs(this.errorW - this.errorActualW);
        this.errorW = this.errorActualW;

        this.forcePD = kp*this.errorActualW + kd*this.derivadaErrorW;
        this.accelerationPD = this.forcePD / inertia;

        if (Math.abs(this.accelerationPD) > angularAccelerationMax) {
            if (this.accelerationPD > 0) {
                this.accelerationPD = angularAccelerationMax;
            } else {
                this.accelerationPD = - angularAccelerationMax;
            }
            
        }
        
        return this.accelerationPD;
    }
    setVelocity() {
        var robot;
        if (this.robot.body.position.y > 1) { //to activate animation of drone
            robot = document.querySelector("#" + this.myRobotID);
            robot.setAttribute('animation-mixer', "clip:*;timeScale:1.5");
        } else {
            robot = document.querySelector("#" + this.myRobotID);
            robot.setAttribute('animation-mixer', "clip:None");
        }


        this.timeoutMotors = setTimeout(this.setVelocity.bind(this), 50);
    }

    updatePosition(rotation, velocity, robotPos) {
        if (simEnabled) {
            let x = velocity.x / 10 * Math.cos(rotation.y * Math.PI / 180);
            let z = velocity.x / 10 * Math.sin(-rotation.y * Math.PI / 180);
            let y = (velocity.y / 10);
            robotPos.x += x;
            robotPos.z += z;
            robotPos.y += y;
        }
        return robotPos;
    }

    startCamera() {
        console.log("Starting camera.");
        if (($('#spectatorDiv').length) && (document.querySelector("#spectatorDiv").firstChild !== undefined)) {
            for (var i = 0; i < this.camerasData.length; i++) {
                var canvasID = '#' + this.camerasData[i]['canvasID'];
                this.canvas2d = document.querySelector(canvasID);
            }
            try {
                this.getImageData_async();
            } catch (err) {
                console.log('Camera error in setup')
            }
        } else {
            setTimeout(this.startCamera.bind(this), 100);
        }
    }

    getImageData_async() {
        /**
         * This function stores image from the robot in the variable
         * "imagedata", this allows to obtain image from the robot
         * with getImage() function.
         */
        if (simEnabled) {
            for (var i = 0; i < this.camerasData.length; i++) {
                this.camerasData[i]['image'] = cv.imread(this.camerasData[i]['canvasID']);
            }
        }
        this.timeoutCamera = setTimeout(this.getImageData_async.bind(this), 60);
    }

    startRaycasters(distance, numOfRaycasters) {
        /**
         * This function enables/disables raycasters (position sensors)
         * for the robot.
         *
         * @distance (Number): Distance which the rays will detect objects.
         * @numOfRaycasters (Number): Number of Raycaster.
         */
        if (!this.activeRays) {
            console.log("Starting raycaster");
            let emptyEntity = document.querySelector("a-scene");
            if ((numOfRaycasters % 2) === 0) {
                numOfRaycasters += 1;
            }
            var offsetAngle = 180 / numOfRaycasters;
            var angle = -90;
            for (var i = 0; i < numOfRaycasters; i++) {
                if (i === (numOfRaycasters - 1) / 2) {
                    angle += offsetAngle;
                    var group = "center";
                } else if (i < (numOfRaycasters - 1) / 2) {
                    angle += offsetAngle;
                    group = "left";
                } else if (i > (numOfRaycasters - 1) / 2) {
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
        /**
         * This function appends raycasters entities to the robot.
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
        /**
         * This function erases all raycasters for the robot.
         */
        var emptyEntity = document.querySelector("#positionSensor");
        while (emptyEntity.firstChild) {
            this.removeListeners(emptyEntity.firstChild);
            emptyEntity.removeChild(emptyEntity.firstChild);
        }
        this.activeRays = false;
        console.log("Stopping raycaster");
    }

    setListener() {
        /**
         * This function sets up intersection listeners for each raycaster.
         */
        for (var i = 0; i < this.raycastersArray.length; i++) {
            this.raycastersArray[i].addEventListener('intersection-detected-' + this.raycastersArray[i].id,
                this.updateDistance.bind(this));

            this.raycastersArray[i].addEventListener('intersection-cleared-' + this.raycastersArray[i].id,
                this.eraseDistance.bind(this));
        }
    }

    removeListeners(raycaster) {
        /**
         * This function disables intersection listeners.
         */
        raycaster.removeEventListener('intersection-detected-' + raycaster.id, () => {
            console.log("removed");
        });
        raycaster.removeEventListener('intersection-cleared-' + raycaster.id, () => {
            console.log("removed");
        });
    }

    updateDistance(evt) {
        /**
         * This function is called when an intersection is detected and updates the distance
         * to the point of intersection.
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
        /**
         * This function is called when the intersection is cleared and
         * removes the distance from the array.
         */
        let id = evt.target.id;
        let targetClass = evt.target.classList[0];

        for (var i = 0; i < this.distanceArray[targetClass].length; i++) {
            if (this.distanceArray[targetClass][i].id === id) {
                this.distanceArray[targetClass].splice(i, 1);
            }
        }
    }

    getPosition() {
        /**
         * This function returns an object with X-Y-Z positions and rotation (theta)
         * for the Y axis.
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
}

// utils
RobotI.prototype.sleep = sleep;
RobotI.prototype.getRobots = getRobots;
// HAL
RobotI.prototype.advance = advance;
RobotI.prototype.advanceTo = advanceTo;
RobotI.prototype.setV = setV;
RobotI.prototype.setW = setW;
RobotI.prototype.setL = setL;
RobotI.prototype.move = move;
RobotI.prototype.upTo = upTo;
RobotI.prototype.downTo = downTo;
RobotI.prototype.turnUpTo = turnUpTo;
RobotI.prototype.land = land;
RobotI.prototype.takeOff = takeOff;
RobotI.prototype.getV = getV;
RobotI.prototype.getW = getW;
RobotI.prototype.getL = getL;
RobotI.prototype.getDistance = getDistance;
RobotI.prototype.getDistances = getDistances;
RobotI.prototype.readIR = readIR;
// vision
RobotI.prototype.getImage = getImage;
RobotI.prototype.getColoredObject = getColoredObject;
RobotI.prototype.getObjectColorRGB = getObjectColorRGB;
RobotI.prototype.getObjectColorPositionRGB = getObjectColorPositionRGB;
RobotI.prototype.getColorCode = getColorCode;
// console
RobotI.prototype.printConsole = printConsole;
RobotI.prototype.inputConsole = inputConsole;

