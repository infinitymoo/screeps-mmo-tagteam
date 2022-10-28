var u = require('util.common');

/**
 * Utility and common functions regarding base management
 */
var baseCommon = {

    //Caching of tick-scope static data
    ownedRooms: [],
    spawnQueues: {},

    /**
     * Runs the loops for managing bases
     */
    run:function() {
        this.garbageCollection();
        this.coldBoot();
        spawnCommon.run();
        linkCommon.run();
        this.towerControl();
    },

    /**
     * Saves the cached state data into Memory
     */
    save:function() {
        //we don't save ownedRooms in Memory, because we don't modify the data

        //spawnQueue
        for( let i in this.spawnQueues ) {
            Memory.rooms[i].spawnQueue = this.spawnQueues[i];
        }
    },

    /**
     * Cycle through spawns to get rooms with owned controllers
     * @return {Array} roomArray
     */
    getOwnedRooms() {
        if( this.ownedRooms.length > 0)
            return this.ownedRooms;

        let rooms = []; //forces unique keys so don't have to write logic for duplicates
        for( i in Game.spawns ) {
            let newRoomName = Game.spawns[i].room.name;
            rooms.push(newRoomName);
            if(!Memory.rooms[newRoomName])
                Memory.rooms[newRoomName] = {};
        }

        rooms = _.uniq(rooms);
        this.ownedRooms = rooms;

        return this.ownedRooms;
    },

    /**
     * Returns spawnQueue for given room - only works for owned rooms with spawn structure(s)
     * @param {string} roomName 
     */
    getSpawnQueue(roomName) {
        // if cache not set, set it from Memory and return
        if( !this.spawnQueues[roomName] ) {            
            let rooms = this.getOwnedRooms();
            if( rooms.includes(roomName) ) {
                if( Memory.rooms[roomName].spawnQueue ) {
                    this.spawnQueues[roomName] = Memory.rooms[roomName].spawnQueue;
                }
                else {
                    this.spawnQueues[roomName] = {};
                    Memory.rooms[roomName].spawnQueue = this.spawnQueues[roomName];
                }
            }
            else
                throw new Error(`E baseCommon.getSpawnQueue() can't get spawnqueue for unowned room ${roomName}, we only own rooms: ${JSON.stringify(rooms)}`);
        }

        return this.spawnQueues[roomName];
    },

    /**
     * Adds a spawn request to the given room's spawn queue with spawn parameters provided
     * @param {string} roomName 
     * @param {Collection} spawnParms 
     * @param {number} overridePriority number of queue to push onto
     */
    pushToSpawnQueue(roomName, spawnParms, overidePriority = 0) {

        if(!roomName || !spawnParms) throw new Error(`base.common pushToSpawnQueue func parms invalid: roomName=${roomName} spawnParms=${JSON.stringify(spawnParms)}`);
        let overide = overidePriority; if(overide == 0 && spawnParms.overidePriority) overide = spawnParms.overidePriority;

        //console.log(`** pushToSpawnQueue roomName ${roomName} and spawnParms ${JSON.stringify(spawnParms)}`);

        //insures initialization happens and we work with cache to update spawn queue at the end.
        let queue = this.getSpawnQueue(roomName);
        if( Object.keys(queue).length < 1 ) queue = spawnQueueStruct;

        let oIndex = 1;
        if( overide > 0 ) {
            spawnParms.overidePriority = overide;
            let sQKeys = Object.keys(queue); //p,g,e
            for( let k in sQKeys ) {
                let sQChildKeys = Object.keys(queue[sQKeys[k]]);
                for( let c in sQChildKeys ) {
                    if( oIndex == overide ) {
                        queue[sQKeys[k]][sQChildKeys[c]].push(spawnParms);
                        oIndex++;
                    }
                    if( oIndex > overide )
                        break;
                }
                if( oIndex > overide )
                    break;
            }
        }
        else {
            let priority = this.prioritizeSpawn(spawnParms);
            u.debug(priority,`pushToSpawnQueue normal priority`);
            queue[Object.keys(priority)[0]][priority[Object.keys(priority)[0]]].splice(0,0,spawnParms);
        }
        this.spawnQueues[roomName] = queue;
    },

    /**
     * Finds first entry in prioritized spawn queue and returns it
     * 
     * @param {string} roomName 
     */
    //TODO optimise so I won't have to go through whole list every time.
    getNextSpawning(roomName) {

        let spawnQueue = this.getSpawnQueue(roomName);
        let spawnParms;
        let gotOneAlready = false;

        //u.debug(spawnQueue,`getNextSpawning spawnQueue retrieved`);

        _.forEach(spawnQueue.p, (pQ) => {
            if( !gotOneAlready )
                if(pQ.length > 0) {
                    spawnParms = pQ.pop();
                    gotOneAlready = true;
                    //u.debug(spawnParms,`getNextSpawning pQ`);
                }
        });
        if( !gotOneAlready )
            _.forEach(spawnQueue.g, (gQ) => {
                if( !gotOneAlready )
                    if(gQ.length > 0) {
                        spawnParms = gQ.pop();
                        gotOneAlready = true;
                        //u.debug(spawnQueue,`getNextSpawning gQ`);
                    }
            });
        if( !gotOneAlready )
            _.forEach(spawnQueue.e, (eQ) => {
                if( !gotOneAlready )
                    if(eQ.length > 0) {
                        spawnParms = eQ.pop();
                        gotOneAlready = true;
                        //u.debug(spawnQueue,`getNextSpawning eQ`);
                    }
            });

        //u.debug(gotOneAlready,`getNextSpawning gotOneAlready`);

        if(gotOneAlready)
            return spawnParms;
        else
            return false;
    },

    /**
     * Uses spawnQueueStruct to prioritize by role.
     * 
     * @param {Collection} spawnParms
     */
    prioritizeSpawn(spawnParms) {
        //validation
        if(!spawnParms) throw new Error(`E baseCommon.prioritizeSpawn() called without spawnParms`);
        if(!spawnParms.memory.role ) throw new Error(`E baseCommon.prioritizeSpawn() called without spawnParms.memory.role`);

        //u.debug(spawnParms,`prioritizeSpawn spawnParms`);

        //prioritize by role - must remain sycned with spawnQueueStruct structure
        switch(spawnParms.memory.role) {
            case "refiller" : return {p:"baseFunction"};
            case "defender" : return {p:"defense"};
            case "repairer" : return {p:"maintenance"};
            case "harvester" : return {g:"acquisition"};
            case "reserver" : return {g:"reserve"};
            case "transport" : return {g:"logistics"};
            case "refiner" : return {g:"refine"};
            case "surveyer" : return {g:"survey"};
            case "builder" : return {e:"baseExpansion"};
            case "upgrader" : return {e:"baseUpgrader"};
            case "" : return {e:"offense"};
            default: throw new Error(`E baseCommon.prioritizeSpawn() couldn't determine priority for spawn with role ${spawnParms.role}`);
        }
    },

    coldBoot() {
        let myRooms = this.getOwnedRooms();
        for( let r in myRooms ) {
            try {
                let roomName = myRooms[r];
                var creepAmount = 0;
                for(var i in Memory.creeps) {
                    if(Memory.creeps[i].homeRoom == roomName)
                        creepAmount++;
                };

                let coldBootCooldown = this.getColdBootCooldown(roomName);
                
                if( creepAmount < 3 && !coldBootCooldown ) {
                    
                    const spawns = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {
                        filter: { structureType: STRUCTURE_SPAWN }
                    });

                    var sources = Game.rooms[roomName].find(FIND_SOURCES);
                    var closestSource = spawns[0].pos.findClosestByPath(FIND_SOURCES);
                    
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'courier',role:'transport'},sizingParms:{policy:"urgent"}},1);
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'miner',role:'harvester',source:closestSource.id},sizingParms:{policy:"urgent"}},1);
                    if(Game.rooms[roomName].store) {
                        baseCommon.pushToSpawnQueue(roomName,{memory:{class:'courier',role:'refiller'},sizingParms:{policy:"urgent"}},1);
                    }

                    /*                    
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'worker',role:'upgrader'},sizingParms:{policy:"urgent"}},1);
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'miner',role:'harvester',source:sources[1].id},sizingParms:{policy:"urgent"}},1);
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'miner',role:'harvester',source:sources[0].id},sizingParms:{policy:"urgent"}},1);
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'courier',role:'transport'},sizingParms:{policy:"urgent"}},1);
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'courier',role:'transport'},sizingParms:{policy:"urgent"}},1);
                    baseCommon.pushToSpawnQueue(roomName,{memory:{class:'miner',role:'harvester',source:sources[1].id},sizingParms:{policy:"urgent"}},1);
                    */

                    this.setColdBootCooldown(roomName);
                }
            }
            catch( problem ) {
                console.log(`E baseCommon.run(coldBoot()): ${problem.name}:${problem.message} ${problem.stack}`);
            }
        }
    },

    /**
     * Returns true if coldboot
     * @param {string} roomName 
     * @returns boolean
     */
    getColdBootCooldown(roomName) {
        let isOnCooldown = false;

        if( Memory.rooms[roomName].coldBootCooldown ) {
            if( Game.time < Memory.rooms[roomName].coldBootCooldown )
                isOnCooldown = true;
        }

        return isOnCooldown;
    },

    /**
     * Returns true if coldboot
     * @param {string} roomName 
     * @returns boolean
     */
    setColdBootCooldown(roomName) {
        Memory.rooms[roomName].coldBootCooldown = Game.time + 500;
    },

    towerControl() {
        var homeRoom = Memory.homeRoom;
        if(!homeRoom) {
            homeRoom = 'E38N53';
        }
        try {
            /** TOWER CONTROL */
            var towers = Game.rooms[homeRoom].find(FIND_STRUCTURES, {
                            filter: (structure) => {
                                return (structure.structureType == STRUCTURE_TOWER);
                            }
                        });
                        
            if(towers.length > 0) {
        
                var closestHostile = towers[0].pos.findClosestByRange(FIND_HOSTILE_CREEPS);
                if(closestHostile) {
                    _.forEach(towers, (tower) => {
                        tower.attack(closestHostile)
                    })
                }
                /*
                else {
                    var closestDamagedStructure = towers[0].pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (structure) =>
                            (structure.hits < structure.hitsMax) && 
                            (structure.structureType != STRUCTURE_WALL) &&
                            structure.hits < 1000000
                        });
                    if(closestDamagedStructure) {
                        _.forEach(towers, (tower) => {
                            tower.repair(closestDamagedStructure);
                        })
                    }
                    else {
                        closestDamagedStructure = towers[0].pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) =>
                                (structure.hits < structure.hitsMax) && 
                                (structure.structureType != STRUCTURE_WALL) &&
                                structure.hits < 2000000
                            });
                        if(closestDamagedStructure) {
                            _.forEach(towers, (tower) => {
                                tower.repair(closestDamagedStructure);
                            })
                    }
                    }
                }
                */
            }
        }
        catch( problem ) {
            console.log(`E baseCommon.run(towerControl()): ${problem.name}:${problem.message} ${problem.stack}`);
        }
    },

    addRoomCachedPickables:function(roomPos) {
        
    },

    validateRoomCachedPickables:function() {

    },

    /**
     * Remove old creep data and enact default behaviour when that happens which is spawning lost creep for now
     */
    garbageCollection:function() {
        try {
            for(var creepName in Memory.creeps) {
                if(!Game.creeps[creepName]) {
                    if(!Memory.creeps[creepName].norespawn && !(Memory.creeps[creepName].role == "breaker" || Memory.creeps[creepName].role == "attacker") )
                        spawner.queueSpawn({memory:Memory.creeps[creepName]})
                    delete Memory.creeps[creepName];
                }
            }
        }
        catch( problem ) {
            console.log(`Exception base.comon garbage collection: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    }
}

var spawnCommon = {

    adjacentCreeps:{},

    /**
     * Manages spawn structure behaviour
     */
    run() {        
        try {
            for(var spawn in Game.spawns)
                this.runSpawn(Game.spawns[spawn]);            
        }
        catch( problem ) {
            console.log(`E baseCommon->spawnCommon.run(): ${problem.name}: ${problem.message} ${problem.stack}`);
        }
    },

    /**
     * Populates cache var to track creep adjacent to spawns
     */
    findAdjacentCreeps() {
        if( this.adjacentCreeps.length > 0 )
            return this.adjacentCreeps;

        for(let s in Game.spawns) {
            for( let c in Game.creeps) {
                if( c.isNearTo(s.pos) )
                    this.adjacentCreeps.push({s:s.id,c:c.id});
            }
        }
        console.log(`** findAdjacentCreeps `);u.debug(this.adjacentCreeps);
    },

    /**
     * Retrieves next spawnqueue parms and primes it for spawning
     * @param {string} roomName 
     * @returns {Object} spawnParms
     */
    processNextSpawning(roomName) {
        //retrieve next spawnable
        let spawnParms = baseCommon.getNextSpawning(roomName);

        if(spawnParms) {            
            //cleanup parms
            if(spawnParms.memory._trav)
                delete spawnParms.memory._trav;
            if(spawnParms.memory.transportCoverage) { 
                delete spawnParms.memory.transportCoverage
                delete spawnParms.memory.transportList;
            }
            if(spawnParms.memory.role == "transport") { 
                delete spawnParms.memory.target;
            }

            //initialize basic parms if none specified                        
            if(!spawnParms.memory.homeRoom) {
                spawnParms.memory.homeRoom = roomName;
            }
        }

        return spawnParms;
    },

    runSpawn(spawn) {
        try {
            if(!spawn.spawning)
            {
                let result = -1000;
                let thisRoom = spawn.room.name;

                let spawnParms = this.processNextSpawning(thisRoom);
                
                if(spawnParms) {

                    let body = this.designBody(thisRoom,spawnParms.memory.class,spawnParms.memory.role,spawnParms.sizingParms);

                    let name = `${spawnParms.memory.class}-${spawnParms.memory.role}-${Math.floor(Math.random() * 65536)}`;
                    
                    result = spawn.spawnCreep(body,name,spawnParms);

                    if( result == ERR_NOT_ENOUGH_ENERGY && spawnParms.memory.role == "refiller") {
                        body = this.designBody(thisRoom,spawnParms.memory.class,spawnParms.memory.role,{policy:"urgent"});
                        result = spawn.spawnCreep(body,name,{memory:spawnParms.memory});
                    }
                    
                    if( result < 0 ) {
                        baseCommon.pushToSpawnQueue(thisRoom,spawnParms); //not sure if this patch is needed, thought i had another bug
                    }
                }
                else
                    throw new Error(`E baseCommon->spawnCommon.runSpawn didn't have spawnParms: ${JSON.stringify(spawnParms)}`);
                
                // if(result < 0)
                //     console.log("spawner error: "+result);
                
            }
            else
                new RoomVisual(spawn.room.name).text("🚧",spawn.pos.x,spawn.pos.y+0.5);
        }
        catch(problem) {            
            console.log(`E baseCommon.runSpawn(): ${problem.name}:${problem.message} ${problem.stack}`);
        }
    },

    /**
     * Calculates body composition using class, role, and sizingpolicy [urgent,optimise,max]
     * @param {string} roomName 
     * @param {string} className 
     * @param {string} roleName 
     * @param {Collection} sizingParms 
     * @returns {Array} body
     */
    designBody(roomName,className,roleName,sizingParms = {}) {
        //validation
        if(!roomName) throw new Error(`E baseCommon.designBody() called without roomName`);
        if(!className) throw new Error(`E baseCommon.designBody() called without className`);
        if(!roleName) throw new Error(`E baseCommon.designBody() called without roleName`);

        let body = [];
        try{
            //initialization
            let sizingPolicy = sizingParms.policy;
            if(!sizingPolicy) sizingPolicy = `max`;
            let sCapacity = Game.rooms[roomName].energyCapacityAvailable;
            let sAvailable = Game.rooms[roomName].energyAvailable;

            //u.debug(``,`* designBody parms ${roomName} ${className} ${roleName} ${JSON.stringify(sizingParms)}`);

            switch(className) {            

                //scout
                case "surveyer":
                    body.push(MOVE);
                    break;

                //static storage-sitter using reserved spots
                case "distributor": 
                    body.push(MOVE);
                    if( sizingPolicy == "max")
                        carryCount = Math.floor( (sCapacity - BODYPART_COST[MOVE]) / BODYPART_COST[CARRY] );
                    else //sizingPolicy == "urgent" || urgentPolicy == "optimise"
                        carryCount = Math.floor( (sAvailable - BODYPART_COST[MOVE]) / BODYPART_COST[CARRY] );
                    if( carryCount < 1 ) carryCount = 1;
                    while (carryCount >= 1) { carryCount--; body.push(CARRY) };
                    break;

                //refiller,transport,refiner
                case "courier":
                    let carryCount = 1; 
                    switch(roleName) {
                        case "refiller":
                        case "refiner":
                            if( sizingPolicy == "max" )
                                carryCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]*2) )
                            else if ( sizingPolicy == "urgent" )
                                carryCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]*2) );
                            while (carryCount >= 1) { carryCount--; body.push(CARRY,CARRY,MOVE); };
                            break;
                        //transport
                        default:                            
                            if( sizingPolicy == "max" )
                                carryCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]) );                            
                            else if ( sizingPolicy == "urgent" )
                                carryCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]) );
                            
                                while (carryCount >= 1) { carryCount--; body.push(CARRY,MOVE); };
                    }
                    break;

                //builder,upgrader,repairer
                case "worker":
                    switch(roleName) {
                        case "builder":
                        case "upgrader":
                        case "repairer":
                        default:
                            let partCount = 1;
                            if( sizingPolicy == "max")
                                partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) );
                            else
                                partCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) );
                            while (partCount >= 1) { partCount--; body.push(CARRY,WORK,MOVE); };
                    }
                    break;

                case "reserver":
                    body.push[MOVE,MOVE,CLAIM,CLAIM];
                    break;

                case "defender":
                    let partCount = 1;
                    partCount = Math.floor( sCapacity / (BODYPART_COST[TOUGH] + BODYPART_COST[MOVE]*2 + BODYPART_COST[ATTACK]) );
                    for( let i = 0; i < partCount; i++) body.push(TOUGH);
                    for( let i = 0; i < partCount; i++) body.push(MOVE,MOVE);
                    for( let i = 0; i < partCount; i++) body.push(ATTACK);
                    break;

                case "miner":
                    switch(roleName) {
                        case "harvester":
                        default:
                            body.push(CARRY);
                            let partCount = 1;
                            if( sizingPolicy == "max")
                                partCount = Math.floor( sCapacity - BODYPART_COST[CARRY] ) / (BODYPART_COST[MOVE] + BODYPART_COST[WORK]*2);
                            else if( sizingPolicy == "custom") {
                                let designOpt = sizingParms.design;
                                switch(designOpt) {
                                    case "remote": body.push(WORK,WORK,WORK,MOVE,MOVE,MOVE); partCount = 0; break;
                                    case "keeper": body.push(WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,MOVE,MOVE,MOVE,MOVE,MOVE); partCount = 0; break;
                                    case "reserved":
                                    default: body.push(WORK,WORK,WORK,WORK,WORK,MOVE,MOVE,MOVE); partCount = 0; break;
                                }
                            }
                            else if( sizingPolicy != "urgent")
                                partCount = Math.floor( sAvailable - BODYPART_COST[CARRY] ) / (BODYPART_COST[MOVE] + BODYPART_COST[WORK]*2);
                            else {
                                if( sAvailable < 200 ) sAvailable = 200; // minimum body size
                                partCount = Math.floor( sAvailable - BODYPART_COST[CARRY] ) / (BODYPART_COST[MOVE] + BODYPART_COST[WORK]);
                                while (partCount >= 1) { partCount--; body.push(WORK,MOVE); };
                            }
                            //won't have partCount if already did urgent one just above.
                            while (partCount >= 1) { partCount--; body.push(WORK,WORK,MOVE); };                            
                    }
                    break;
                default: throw Error(`E baseCommon.designBody couldn't process class switch with ${className}`);
            }
        }
        catch(problem) {            
            console.log(`E baseCommon.designBody(): ${problem.name}:${problem.message} ${problem.stack}`);
        }
        
        //u.debug(body,"body design");

        return body;
    }
}

/**
 * Spawnqueue tiered arrays to make sorting and prioritization easier - must implement tick goals for replacing creep in time.
 */
var spawnQueueStruct = {
    //must remain synced with prioritizeSpawn.
    
    //1 - Preservation (p)
	p: {
        baseFunction:[], // e.g. Refillers
        defense:[], // e.g. Active Defensive Mission Creep
        maintenance:[] // e.g. Repairers
    },

    //2 - Generation (g)
    g: {
        acquisition:[], // e.g. Harvesters
        reserve:[], // e.g. Reservers
        logistics:[], // e.g. Transports
        refine:[], // e.g. Lab and Factory Operators
        survey:[] // e.g. Scouts
    },
	
    //3 - Expansion (e)
	e: {
        baseExpansion:[], // e.g. Builder, Claimer
		baseUpgrader:[], //Base Upgrading (Controller Upgrader, Rampart and wall building)
		offense:[] //Offense
    }
}

var linkCommon = {
    roomLinks: {},

    run() {
        let rooms = baseCommon.getOwnedRooms();
        for( r in rooms ) {
            if(!this.validatateRoomLinks(rooms[r]) )
                this.setupRoomLinks(rooms[r]);
            this.runRoom(rooms[r]);
        }
    },

    /**
     * Populates roomLinks cache and checks 
     * @param {string} roomName 
     * @returns {boolean}
     */
    validatateRoomLinks(roomName) {
        let links = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_LINK)
            }
        });

        if( !this.roomLinks[roomName] ) {
            this.roomLinks[roomName] = [];
        }

        if( links.length > 0 ) {
            for(let l in links) {
                this.roomLinks[roomName].push(links[l].id);
            }

            if( !Memory.rooms[roomName].links )
                return false;

            if( links.length >= 2)
                if( !Memory.rooms[roomName].links.baseLink ||
                    !Memory.rooms[roomName].links.controllerLink )
                    return false;
            if( links.length >= 3)
                if( !Memory.rooms[roomName].links.sourceLinkA )
                    return false;
            if( links.length >= 4)
                if( !Memory.rooms[roomName].links.sourceLinkB )
                    return false;
        }
        return true;
    },

    setupRoomLinks(roomName) {
        let links = this.roomLinks[roomName];
        let sources = {};

        if( !Memory.rooms[roomName].links )
            Memory.rooms[roomName].links = {};

        if( links.length > 2 )
            sources = Game.rooms[roomName].find(FIND_SOURCES);
            
        _.forEach(links,(l) => {
            let link = Game.getObjectById(l);
            if( Game.rooms[roomName].controller.pos.inRangeTo(link.pos,2) ) {
                Memory.rooms[roomName].links.controllerLink = link.id;
                return;
            }
            
            if( Game.rooms[roomName].storage ) {
                if( Game.rooms[roomName].storage.pos.inRangeTo(link.pos,2) ) {
                    Memory.rooms[roomName].links.baseLink = link.id;
                    return;
                }
            }

            let sourceA = "";
            if( links.length == 3 ) {
                if( sources.length > 0 ) {
                    for( s in sources ) {
                        if( sources[s].pos.inRangeTo(link.pos,2) ) {
                            Memory.rooms[roomName].links.sourceLinkA = link.id;
                            sourceA = link.id;
                            return;
                        }
                    }
                }
            }

            if( links.length == 4 ) {
                if( sources.length > 0 ) {
                    for( s in sources ) {
                        if( sources[s].pos.inRangeTo(link.pos,2) ) {
                            if(link.id != sourceA) {
                                Memory.rooms[roomName].links.sourceLinkB = link.id;
                                return false; //returning false will break the foreach loop completely, normal returns skips to next iteration only
                            }
                        }
                    }
                }
            }
        });

    },

    /**
     * Loops through a roomn's links
     * @param {string} roomName 
     */
    runRoom(roomName) {
        let links = this.roomLinks[roomName];

        if(links.length == 2) {
            let baseLink = Game.getObjectById(Memory.rooms[roomName].links.baseLink);
            let controllerLink = Game.getObjectById(Memory.rooms[roomName].links.controllerLink);
            if(!baseLink || !controllerLink) throw new Error(`E baseCommon=>linkCommon.runRoom ${roomName} has 2 links but no base/controller pair: ${JSON.stringify(Memory.rooms[roomName.links])}`)

            this.sendEnergy( baseLink, controllerLink, 600 );
        }

        if(links.length > 2) {
            //initialization
            let baseLink = Game.getObjectById(Memory.rooms[roomName].links.baseLink);
            let controllerLink = Game.getObjectById(Memory.rooms[roomName].links.controllerLink);
            let sourceLinkA = Game.getObjectById(Memory.rooms[roomName].links.sourceLinkA);
            let sourceLinkB = Game.getObjectById(Memory.rooms[roomName].links.sourceLinkB);
            let result = -2000;

            //sourceB is optional since some rooms have 1 energy source and only rcl8 allows a 4th link
            if(!baseLink || !controllerLink || !sourceLinkA) throw new Error(`E baseCommon=>linkCommon.runRoom ${roomName} has 4 links but no base/controller/sourceLink : ${JSON.stringify(Memory.rooms[roomName.links])}`)

            result = this.sendEnergy( sourceLinkA, controllerLink, 600 );
            // if( result != -1000 ) u.debug(result,`link debug - sourceLinkA sent to controllerLink`);
            if( result == OK ) {
                return;
            }
            if(sourceLinkB)
                if( this.sendEnergy( sourceLinkB, controllerLink, 600 ) == OK )
                    return;
            
            if(controllerLink.store.getUsedCapacity(RESOURCE_ENERGY) < 200) {
                result = this.sendEnergy( baseLink, controllerLink, controllerLink.store.getCapacity(RESOURCE_ENERGY) - 20 );
                // if( result != -1000 ) u.debug(result,`link debug - baseLink sent to controllerLink`);
                if( result == OK ) {
                    return;
                }
                    
            }

            result = this.sendEnergy( sourceLinkA, baseLink, baseLink.store.getCapacity(RESOURCE_ENERGY) - 20, 200 );
            // if( result != -1000 ) u.debug(result,`link debug - sourceLinkA sent to baseLink`);
            if( result == OK ) {
                return;
            }

            if(sourceLinkB)
                if( this.sendEnergy( sourceLinkB, baseLink, baseLink.store.getCapacity(RESOURCE_ENERGY) - 20, 200 ) == OK )
                    return;
        }
    },

    /**
     * Transfers energy from source to target when target is under threshold (default 400) and source above threshold (default 0)
     * @param {StructureLink} source 
     * @param {StructureLink} target 
     * @param {number} targetThreshold default 400
     * @param {number} sourceThreshold default 200
     */
    sendEnergy(source,target,targetThreshold = 400,sourceThreshold = 0) {
        let result = -1000;
        if( target.store.getUsedCapacity(RESOURCE_ENERGY) <= targetThreshold &&
            source.store.getUsedCapacity(RESOURCE_ENERGY) >= sourceThreshold
            && source.cooldown == 0) {
                result = source.transferEnergy(target);
                // u.debug(result,`sendEnergy result`)
        }
        return result;
    }
}
    
// if(Game.rooms['W26N57'].controller.level == 5) {
//     if(Game.flags['Flag1']) {
//         var result = Game.flags['Flag1'].pos.createConstructionSite(STRUCTURE_TOWER,'Tower2');
//         if( result == OK )
//             Game.flags['Flag1'].remove();
//     }
        
// }

module.exports = baseCommon;