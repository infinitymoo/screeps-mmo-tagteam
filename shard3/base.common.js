var u = require('util.common');
var diplomacy = require('diplomacy');

/**
 * Utility and common functions regarding base management
 */
var baseCommon = {

    //Caching of tick-scope static data
    cpuUsages: {},

    ownedRooms: [],
    spawnQueues: {},

    /**
     * Runs the loops for managing bases
     */
    run:function() {

        u.debug( Game.cpu.getUsed(), `pre-base cpuUsage`);

        cpuUsages = {
            garbageCollection:0,
            spawnCommon:0,
            linkCommon:0,
            towerControl:0,
            defenseControl:0,
            marketControl:0
        };

        let pre = Game.cpu.getUsed();
        this.garbageCollection();
        let post = Game.cpu.getUsed();
        cpuUsages['garbageCollection'] += (post - pre);        

        //this.coldBoot();

        pre = Game.cpu.getUsed();
        spawnCommon.run();
        post = Game.cpu.getUsed();
        cpuUsages['spawnCommon'] += (post - pre);


        pre = Game.cpu.getUsed();
        linkCommon.run();
        post = Game.cpu.getUsed();
        cpuUsages['linkCommon'] += (post - pre);


        pre = Game.cpu.getUsed();
        this.towerControl();
        post = Game.cpu.getUsed();
        cpuUsages['towerControl'] += (post - pre);


        pre = Game.cpu.getUsed();
        this.defenseControl();
        post = Game.cpu.getUsed();
        cpuUsages['defenseControl'] += (post - pre);


        pre = Game.cpu.getUsed();
        this.marketControl();
        post = Game.cpu.getUsed();
        cpuUsages['marketControl'] += (post - pre);

        u.debug(cpuUsages,'base cpu usages');
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
        //this.ownedRooms = []; // resets heap cache;

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
                console.log(`E baseCommon.getSpawnQueue() can't get spawnqueue for unowned room ${roomName}, we only own rooms: ${JSON.stringify(rooms)}`);
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

        //insures initialization happens and we work with cache to update spawn queue at the end.
        let queue = this.getSpawnQueue(roomName);
        if( queue && Object.keys(queue).length < 1 ) queue = spawnQueueStruct;

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
            if( priority )
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
            case "attacker" : return {p:"defense"};
            case "repairer" : return {p:"maintenance"};
            case "harvester" : return {g:"acquisition"};
            case "reserver" : return {g:"reserve"};
            case "transport" : return {g:"logistics"};
            case "supplier" : return {g:"logistics"};
            case "refiner" : return {g:"refine"};
            case "surveyer" : return {g:"survey"};
            case "builder" : return {e:"baseExpansion"};
            case "claimer" : return {e:"baseExpansion"};
            case "upgrader" : return {e:"baseUpgrader"};
            case "breaker" : return {e:"offense"};
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
                    if(Game.rooms[roomName].storage) {
                        baseCommon.pushToSpawnQueue(roomName,{memory:{class:'courier',role:'refiller'},sizingParms:{policy:"urgent"}},1);
                    }

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
        let rooms = this.ownedRooms;
        for(let r in rooms ) {
            let currentRoom = rooms[r];

            try {
                /** TOWER CONTROL */
                var towers = Game.rooms[currentRoom].find(FIND_STRUCTURES, {
                                filter: (structure) => {
                                    return (structure.structureType == STRUCTURE_TOWER);
                                }
                            });
                            
                if(towers.length > 0) {
            
                    var closestHostile = towers[0].pos.findClosestByRange(FIND_HOSTILE_CREEPS, {
                        filter: (hostileCreep) => {
                            return  !diplomacy.isAlly( hostileCreep.owner.username )
                        }
                    });
                    if(closestHostile) {
                        _.forEach(towers, (tower) => {
                            tower.attack(closestHostile)
                        })
                    }                    
                    else if (Game.time % 20 === 0 ) {                        
                        _.forEach(towers, (tower) => {
                            let closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                            filter: (structure) =>
                                (structure.hits < (structure.hitsMax - 2400)) && 
                                (structure.structureType != STRUCTURE_WALL &&
                                structure.structureType != STRUCTURE_RAMPART)
                            });
                            tower.repair(closestDamagedStructure);
                        });                        
                    }
                }
            }
            catch( problem ) {
                console.log(`E baseCommon.run(towerControl()): ${problem.name}:${problem.message} ${problem.stack}`);
            }
        }
    },

    defenseControl:function() {

        if (Game.time % 5 === 0 ) {

            let rooms = [];
            rooms.push('E37N52');
            _.forEach(Game.creeps,(c) => {
                if( !_.includes(rooms,c.room.name ) && this.getRoomThreatStatus(c.room.name) < 1) {
                    rooms.push(c.room.name); //only run this check once per room I have a creep in
                
                    let hostileCreeps = c.room.find(FIND_HOSTILE_CREEPS, {
                        filter: (hostileCreep) => {
                            return hostileCreep.hits !== 0 &&
                                hostileCreep.owner.username != `Source Keeper` &&
                                !diplomacy.isAlly( hostileCreep.owner.username );
                        }
                    });

                    if( hostileCreeps.length > 0 ) {
                        this.setRoomThreatStatus( c.room.name, hostileCreeps.length );
                    }
                    else {
                        if( Memory.rooms[c.room.name] && Memory.rooms[c.room.name].defending ) {
                            delete Memory.rooms[c.room.name].defending;
                            if( Object.keys(Memory.rooms[c.room.name]).length == 0 )
                                delete Memory.rooms[c.room.name];
                        }
                    }


                    if( hostileCreeps.length == 1 && ( c.room.find(FIND_MY_CREEPS, { filter: (myCreep) => { return myCreep.memory.role == "attacker"; } } ).length <= 1 ) ) {                               
                                                    
                        //don't spawn defenders for source keeper or highway rooms
                        if( c.room.controller && !c.room.controller.owner )
                            this.spawnDefenders( c.memory.homeRoom, c.room.name, hostileCreeps );

                        if( !Memory.rooms[c.room.name] )
                            Memory.rooms[c.room.name] = {};

                        Memory.rooms[c.room.name].defending = Game.time + 1500;
                    }
                }

                if( this.getRoomThreatStatus(c.room.name) > 0 ) {
                    //defending timer expiry
                    if( Memory.rooms[c.room.name] && Memory.rooms[c.room.name].defending && ( Game.time >= Memory.rooms[c.room.name].defending ) ) {
                        delete Memory.rooms[c.room.name].defending;
                        if( Object.keys(Memory.rooms[c.room.name]).length == 0 )
                            delete Memory.rooms[c.room.name];
                    }
                    if( !Memory.rooms[c.room.name] || !Memory.rooms[c.room.name].defending ) {
                        this.setRoomThreatStatus( c.room.name, 0 );
                    }

                    let hostileCreeps = c.room.find(FIND_HOSTILE_CREEPS, {
                        filter: (hostileCreep) => {
                            return hostileCreep.hits !== 0 && !diplomacy.isAlly( hostileCreep.owner.username );
                        }
                    });

                    if( hostileCreeps.length == 0 ) {
                        if( Memory.rooms[c.room.name] && Memory.rooms[c.room.name].defending ) {
                            delete Memory.rooms[c.room.name].defending;
                            if( Object.keys(Memory.rooms[c.room.name]).length == 0 )
                                delete Memory.rooms[c.room.name];
                        }
                    }
                }
            });

        }
    },

    getRoomThreatStatus:function( roomName ) {
        this.initializeIntelDB( roomName );
        
        if( Memory.intelDB[roomName] ) {
            return Memory.intelDB[roomName].activity.threatLevel;
        }
    },

    setRoomThreatStatus:function( roomName, threatLevel ) {
        this.initializeIntelDB( roomName );
        Memory.intelDB[roomName].activity.threatLevel = threatLevel;
        
        if( threatLevel > 0 ) {
            let threatenedCreeps = _.filter(Game.creeps,(creep) => {
                return creep.room.name == roomName &&
                creep.memory.class != "defense" &&
                creep.memory.class != "offense";
            });

            _.forEach( threatenedCreeps, (creep) => {
                creep.memory.fleeing = roomName;
            });
        }

        if( threatLevel == 0 ) {

            let fleeingCreeps = _.filter( Game.creeps, (anyCreep) => {
                return anyCreep.memory.fleeing = roomName;
            });

            _.forEach( fleeingCreeps, (fCreep) => {
                delete fCreep.memory.fleeing;
            });
        }
    },

    spawnDefenders: function( homeRoom, targetRoom, hostileCreeps ) {
        this.pushToSpawnQueue(homeRoom,{memory:{class:'defense',role:'attacker',targetRoom:targetRoom}});
    },

    initializeIntelDB: function( roomName ) {
        let rooms = [];
        if( !Memory.intelDB ) {
            Memory.intelDB = {};
            u.debug(roomName,`getting initialized for intel db 1`);
        }


        if( !roomName ) {
            rooms = this.getOwnedRooms();
        }
        else {
            rooms.push(roomName);
        }
            
        _.forEach( rooms, (r) => {
            if( !Memory.intelDB[r] ) {

                u.debug(roomName,`getting initialized for intel db 2`);

                Memory.intelDB[r] = {};
            
                Memory.intelDB[r].survey = {};
                Memory.intelDB[r].survey.poi = [];
                Memory.intelDB[r].survey.linkedRooms = [];

                Memory.intelDB[r].activity = {};
                Memory.intelDB[r].activity.timestamp = 0;
                Memory.intelDB[r].activity.threatLevel = 0;
                Memory.intelDB[r].activity.owner = false;
                Memory.intelDB[r].activity.hostileStructures = [];
                Memory.intelDB[r].activity.hostileCreeps = [];
                Memory.intelDB[r].activity.scavengeTargets = [];
            }
        });            
        
    },

    addRoomCachedPickables:function() {
        
    },

    validateRoomCachedPickables:function() {

    },

    /**
     * Remove old creep data and enact default behaviour when that happens which is spawning lost creep for now
     */
    garbageCollection:function() {
        try {
            let pre = Game.cpu.getUsed();

            for(var creepName in Memory.creeps) {
                if(!Game.creeps[creepName]) {
                    if( this.respawnFilter(creepName)  ) {


                        this.pushToSpawnQueue(
                            Memory.creeps[creepName].homeRoom, {
                                memory:Memory.creeps[creepName],
                                spawnParms: {
                                    design: Memory.creeps[creepName].mode
                                }
                            });


                    }

                    delete Memory.creeps[creepName];
                }/*
                else {
                    if( this.respawnFilter(creepName) ) {
                        let preSpawnTime = 50;
                        if( Game.creeps[creepName].ticksToLive < preSpawnTime ) {
                            this.pushToSpawnQueue(
                                Memory.creeps[creepName].homeRoom, {
                                    memory:Memory.creeps[creepName],
                                    spawnParms: {
                                        design: Memory.creeps[creepName].mode
                                    }
                                });

                            Game.creeps[creepName].memory.norespawn = true;
                        }
                    }
                }*/
            }
            
            let post = Game.cpu.getUsed();
            u.debug( (post - pre), `push to spawn queue cpu usages`);    
        }
        catch( problem ) {
            console.log(`Exception base.comon garbage collection: ${problem.name}: ${problem.message} ${problem.stack}`);
        }
    },

    respawnFilter:function(creepName) {
        return !Memory.creeps[creepName].norespawn && Memory.creeps[creepName].mode != 'recycle' && 
            !(/*Memory.creeps[creepName].role == "breaker" ||*/ (Memory.creeps[creepName].role == "attacker" && Memory.creeps[creepName].mode != "dorespawn") || !Memory.creeps[creepName].homeRoom)
    },


    // -------------------- View order on console --------------------

    //     JSON.stringify(Game.market.getAllOrders(order => order.resourceType == RESOURCE_HYDROGEN && order.type == ORDER_BUY && Game.market.calcTransactionCost(200, 'E38N53', order.roomName) < 500));
    //     JSON.stringify(Game.market.getAllOrders(order => order.resourceType == RESOURCE_SILICON && order.price > 100 && order.type == ORDER_BUY && Game.market.calcTransactionCost(200, 'E38N53', order.roomName) < 600));
    //     
    marketControl: function() {// Terminal trade execution

        let thisRoom = Game.rooms['E38N53'];
        let thisTerminal = thisRoom.terminal
        if (thisTerminal && (Game.time % 10 == 0)) {
            if (thisTerminal.store[RESOURCE_ENERGY] >= 600 && thisTerminal.store[RESOURCE_SILICON] >= 200) {
                var orders = Game.market.getAllOrders(
                                order => order.resourceType == RESOURCE_SILICON &&
                                order.type == ORDER_BUY &&
                                order.amount >= 200 &&
                                Game.market.calcTransactionCost(200, thisRoom.name, order.roomName) < 600
                );

                orders.sort(function(a,b){return b.price - a.price;});

                if(orders.length > 0)
                if (orders[0].price >= 100) {
                    var result = Game.market.deal(orders[0].id, 200, thisRoom.name);
                    if (result == OK) {
                        //console.log('Order completed successfully');
                    }
                }
            }
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
                delete spawnParms.memory.transportList;
                if( spawnParms.memory.transportCoverage != -1 )
                    delete spawnParms.memory.transportCoverage;
            }
            if(spawnParms.memory.role == "transport" || spawnParms.memory.role == "refiller") {
                delete spawnParms.memory.target;
                delete spawnParms.memory.targetLock;
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

                    // u.debug(spawnParms,`debug pre designBody`);

                    if( !spawnParms.sizingParms )
                        spawnParms.sizingParms = {};
                    if( !spawnParms.sizingParms.design ) {
                        spawnParms.sizingParms.design = spawnParms.memory.mode;
                    }

                    let body = this.designBody(thisRoom,spawnParms.memory.class,spawnParms.memory.role,spawnParms.sizingParms);

                    let name = `${spawnParms.memory.class}-${spawnParms.memory.role}-${Math.floor(Math.random() * 65536)}`;

                    
                    result = spawn.spawnCreep(body,name,spawnParms);

                    // u.debug(body,`debug spawn`);
                    // u.debug(spawn.room.name,`debug spawn`);
                    // u.debug(spawnParms,`debug spawn`);
                    // u.debug(result,`debug spawn`);

                    if( result == ERR_NOT_ENOUGH_ENERGY && spawnParms.memory.role == "refiller") {
                        body = this.designBody(thisRoom,spawnParms.memory.class,spawnParms.memory.role,{policy:"urgent"});
                        result = spawn.spawnCreep(body,name,{memory:spawnParms.memory});
                    }

                    if( result < 0 ) {
                        baseCommon.pushToSpawnQueue(thisRoom,spawnParms); //not sure if this patch is needed, thought i had another bug
                    }
                }
                // else
                //     throw new Error(`E baseCommon->spawnCommon.runSpawn didn't have spawnParms: ${JSON.stringify(spawnParms)}`);
                
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
        let partCount = 1;
        try{
            //initialization
            let sizingPolicy = sizingParms.policy;
            let designPolicy = sizingParms.design;
            if(!sizingPolicy) sizingPolicy = "conserve";
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
                        partCount = Math.floor( (sCapacity - BODYPART_COST[MOVE]) / BODYPART_COST[CARRY] );
                    else if( sizingPolicy == "conserve")
                        partCount = 8;
                    else //sizingPolicy == "urgent" || urgentPolicy == "optimise"
                        partCount = Math.floor( (sAvailable - BODYPART_COST[MOVE]) / BODYPART_COST[CARRY] );
                    if( partCount < 1 ) partCount = 1;
                    if( partCount > 49 ) partCount = 49;
                    while (partCount >= 1) { partCount--; body.push(CARRY) };
                    break;

                //refiller,transport,refiner
                case "courier":
                    switch(roleName) {
                        case "refiller":
                        case "refiner":
                            partCount = 4;
                            // if( sizingPolicy == "conserve" )
                            //     partCount = 4;
                            // else if( sizingPolicy == "max" )
                            //     partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]*2) )
                            // else
                            if ( sizingPolicy == "urgent" )
                                partCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]*2) );
                            else if( sizingPolicy == "conserve")
                                partCount = 8;
                            if( partCount > 16 ) partCount = 16;
                            while (partCount >= 1) { partCount--; body.push(CARRY,CARRY,MOVE); };
                            break;
                        //transport
                        default:

                            if ( sizingPolicy == "urgent" ) {
                                partCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]*2) );
                            }
                            else if( sizingPolicy == "min ") {
                                partCount = 1;
                            }
                            else {
                                if( !designPolicy ) {
                                    sizingPolicy = "conserve";
                                }
                                else if( designPolicy == "remote" ) {
                                    sizingPolicy = "max";
                                }
                                else if( designPolicy == "mineral") {
                                    sizingPolicy = "conserve";
                                }
                                
                                if( sizingPolicy == "conserve") {
                                    partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]) );
                                    partCount = Math.min(7,partCount);
                                }
                                else if( sizingPolicy == "max" ) {
                                    partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY]) );
                                }
                                else
                                    partCount = 15;
                            }
                    }
                    if( partCount > 25 ) partCount = 25;
                    while (partCount >= 1 ) { partCount--; body.push(CARRY,MOVE); };
                    break;

                //builder,upgrader,repairer
                case "worker":
                    switch(roleName) {
                        case "repairer":
                        case "builder":
                            if( !designPolicy ) 
                                designPolicy = "roadworker";
                            if( designPolicy == "roadworker") {
                                partCount = 2;
                                break;
                            }
                            if( designPolicy == "borders") {
                                partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) );
                                partCount = Math.min(3,partCount);
                                break;
                            }
                        case "upgrader":
                        default:
                            if( sizingPolicy == "min")
                                partCount = 1;
                            else if( sizingPolicy == "conserve") {
                                partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) );
                                partCount = Math.min(4,partCount);
                            }
                            else if( sizingPolicy == "max")
                                partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) );
                            else
                                partCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]) );
                    }
                    if( partCount > 16 ) partCount = 16;
                    while (partCount >= 1) { partCount--; body.push(CARRY,WORK,MOVE); };
                    break;

                case "specialist":
                    switch(roleName) {
                        case "upgrader":
                        default:
                            if( sizingPolicy == "max" || sizingPolicy == "conserve")
                                partCount = Math.floor( sCapacity / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]*4) );
                            // else if( sizingPolicy == "conserve")
                            //     partCount = 2;
                            else
                                partCount = Math.floor( sAvailable / (BODYPART_COST[MOVE] + BODYPART_COST[CARRY] + BODYPART_COST[WORK]*4) );
                    }                    
                    if( partCount > 8 ) partCount = 8;
                    while (partCount >= 1) { partCount--; body.push(CARRY,WORK,WORK,WORK,WORK,MOVE); };
                    break;

                case "reserver":
                    if( designPolicy == 'attack' )
                        body.push(MOVE,MOVE,MOVE,MOVE,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM,CLAIM);
                    else
                        body.push(MOVE,MOVE,CLAIM,CLAIM);
                    break;

                case "claimer":
                    body.push(MOVE,CLAIM);
                    break;

                case "defense":
                    partCount = Math.floor( sCapacity / (BODYPART_COST[TOUGH] + BODYPART_COST[MOVE]*2 + BODYPART_COST[ATTACK]) );
                    if( partCount > 4 ) partCount = 4;
                    for( let i = 0; i < partCount; i++) body.push(TOUGH);
                        
                    for( let i = 0; i < partCount; i++) body.push(MOVE,MOVE);
                    for( let i = 0; i < partCount; i++) body.push(ATTACK);
                    break;

                case "offense":
                    
                    switch(designPolicy) {

                        case "mission":
                            //body = [MOVE];
                            // tower drain, 2 creep team, handles max range 2x towers
                            // https://screeps.admon.dev/creep-designer/?share=3-12-0-0-3-0-18-0
                            
                            //body = [TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL,HEAL]

                            break;

                        default:
                            //[MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,ATTACK,HEAL,HEAL,HEAL,HEAL,HEAL]
                            
                            partCount = Math.floor( sCapacity / (BODYPART_COST[ATTACK]*4 + BODYPART_COST[MOVE]*5 + BODYPART_COST[HEAL]) );
                            if( partCount > 5 ) partCount = 5;
                            for( let i = 0; i < partCount; i++) body.push(MOVE,MOVE,MOVE,MOVE,MOVE);
                            for( let i = 0; i < partCount; i++) body.push(ATTACK,ATTACK,ATTACK,ATTACK);
                            for( let i = 0; i < partCount; i++) body.push(HEAL);

                            // partCount = Math.floor( sCapacity / (BODYPART_COST[TOUGH] + BODYPART_COST[MOVE]*2 + BODYPART_COST[ATTACK]) );
                            // if( partCount > 12 ) partCount = 12;
                            // for( let i = 0; i < partCount; i++) body.push(TOUGH);
                            // for( let i = 0; i < partCount; i++) body.push(MOVE,MOVE);
                            // for( let i = 0; i < partCount; i++) body.push(ATTACK);
                            break;

                    }
                    break;

                case "siege":
                    body.push(CARRY);
                    partCount = Math.floor( ( sCapacity - BODYPART_COST[CARRY] ) / ( BODYPART_COST[MOVE] + BODYPART_COST[WORK]) );
                    if( partCount > 16 ) partCount = 16;
                    while (partCount >= 1) { partCount--; body.push(WORK,WORK,MOVE); };
                    break;

                case "miner":

                    switch(roleName) {
                        case "harvester":
                        default:
                            body.push(CARRY,WORK,MOVE);
                            if( sizingPolicy == "urgent" ) {
                                if( sAvailable < 200 ) sAvailable = 200; // minimum body size
                                partCount = Math.floor( sAvailable - BODYPART_COST[CARRY] - BODYPART_COST[MOVE] - BODYPART_COST[WORK]) / (BODYPART_COST[MOVE] + BODYPART_COST[WORK]*2);
                                if( partCount > 24 ) partCount = 24;
                                while (partCount >= 1) { partCount--; body.push(WORK,WORK,MOVE); };
                            }
                            else {
                                if(!designPolicy )
                                    designPolicy = "reserved";
                                // if( sizingPolicy == "normal")
                                // {

                                    switch(designPolicy) {
                                        case "remote": // max 3 work 3 move
                                            partCount = Math.floor( (sCapacity - BODYPART_COST[CARRY] - BODYPART_COST[MOVE] - BODYPART_COST[WORK]) / (BODYPART_COST[MOVE] + BODYPART_COST[WORK]));
                                            partCount = Math.min(partCount,2);
                                            while (partCount >= 1) { partCount--; body.push(WORK,MOVE); };
                                            break;
                                        //case "keeper": body.push(WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,MOVE,MOVE,MOVE,MOVE,MOVE); partCount = 0; break;
                                        case "reserved": // max 5 work 3 move
                                            partCount = Math.floor(( sCapacity - BODYPART_COST[CARRY] - BODYPART_COST[MOVE] - BODYPART_COST[WORK]) / (BODYPART_COST[MOVE] + BODYPART_COST[WORK]*2));
                                                                                       
                                            partCount = Math.min(partCount,2);
                                            while (partCount >= 1) { partCount--; body.push(WORK,WORK,MOVE); };
                                            
                                            break;
                                        case "mineral":
                                            body = [MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY];
                                            partCount = 0;
                                            break;
                                        default:
                                            break;
                                    }
                                // }
                                //won't have partCount if already did urgent one just above.
                                if( partCount > 16 ) partCount = 16;
                                while (partCount >= 1) { partCount--; body.push(WORK,WORK,MOVE); };
                            }
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
        for( let r in rooms ) {
            if(!this.validateRoomLinks(rooms[r]) )
                this.setupRoomLinks(rooms[r]);
            try {
                this.runRoom(rooms[r]);
            }
            catch(problem) {
                u.debug(problem,`E in linksCommon run. ${problem.name} ${problem.message} ${problem.stack}`)
            }
        }
    },

    /**
     * Populates roomLinks cache and checks 
     * @param {string} roomName 
     * @returns {boolean}
     */
     validateRoomLinks(roomName) {
        let links = Game.rooms[roomName].find(FIND_MY_STRUCTURES, {
            filter: (structure) => {
                return (structure.structureType == STRUCTURE_LINK)
            }
        });

        if( !this.roomLinks[roomName] ) {
            this.roomLinks[roomName] = [];
        }

        if( links.length > 1 ) {

            this.roomLinks[roomName] = []; //testing to see if heap is causing issue of multiple pushes adding same links multiple times.
            for(let l in links) {
                this.roomLinks[roomName].push(links[l].id);
            }

            if( !Memory.rooms[roomName].links )
                return false;

            if( links.length >= 2) {
                if( !Memory.rooms[roomName].links.baseLink ||
                    !Memory.rooms[roomName].links.controllerLink )
                    return false;

                if( !Game.getObjectById(Memory.rooms[roomName].links.baseLink) ||
                    !Game.getObjectById(Memory.rooms[roomName].links.controllerLink))
                    return false;
            }
            if( links.length >= 3) {
                if( !Memory.rooms[roomName].links.sourceLinkA )
                    return false;                    

                if( !Game.getObjectById(Memory.rooms[roomName].links.sourceLinkA))
                    return false;
            }
            if( links.length >= 4) {
                if( !Memory.rooms[roomName].links.sourceLinkB )

                    return false;
                if( !Game.getObjectById(Memory.rooms[roomName].links.sourceLinkB))
                    return false;
            }
        }
        return true;
    },

    setupRoomLinks(roomName) {
        let links = this.roomLinks[roomName];
        let sources = {};

        u.debug(links,`setupRoomLinks ${roomName} roomlinks`);

        if( !Memory.rooms[roomName].links )
            Memory.rooms[roomName].links = {};

        if( links.length > 2 )
            sources = Game.rooms[roomName].find(FIND_SOURCES);
            
        _.forEach(links,(l) => {
            let link = Game.getObjectById(l);
            if( Game.rooms[roomName].controller.pos.inRangeTo(link.pos,3) ) {
                Memory.rooms[roomName].links.controllerLink = link.id;
                return;
            }
            
            if( Game.rooms[roomName].storage ) {
                if( Game.rooms[roomName].storage.pos.inRangeTo(link.pos,3) ) {
                    Memory.rooms[roomName].links.baseLink = link.id;
                    return;
                }
            }

            let sourceA = "";
            if( links.length >= 3 ) {
                let sourceALink = Game.getObjectById(Memory.rooms[roomName].links.sourceLinkA);
                if(!sourceALink)
                    if( sources.length > 0 ) {
                        for( s in sources ) {
                            if( sources[s].pos.inRangeTo(link.pos,2) ) {
                                Memory.rooms[roomName].links.sourceLinkA = link.id;
                                sourceA = link.id;
                            }
                        }
                    }
                else
                    sourceA = Memory.rooms[roomName].links.sourceLinkA;
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