/**
 * Utility and common functions regarding base management
 */
var baseCommon = {

    //Caching of tick-scope static data
    ownedRooms: [],

    run:function() {
        try {
            for(var spawn in Game.spawns) {
                spawner.run(Game.spawns[spawn]);
            }
        }
        catch( problem ) {
            console.log(`Exception thrown baseCommon run section: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    },

    /**
     * Cycle through spawns to get rooms with owned controllers
     * @return {Array} roomArray
     */
    getOwnedRooms:function() {
        if( this.ownedRooms.length > 0)
            return this.ownedRooms;

        let rooms = {}; //forces unique keys so don't have to write logic for duplicates
        for( i in Game.spawns ) {
            rooms[Game.spawns[i].room.name] = true;
        }
        this.ownedRooms = [];
        for( n in rooms ) {
            this.ownedRooms.push(n);
        }

        return this.ownedRooms;
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

/**
 * Sub-Utility to handle some spawning tasks
 */

var spawner = {
    run: function(spawn){
        if(!spawn.spawning)
        {
            let result = -1000;
            let thisRoom = spawn.room.name;
            if(!Memory.rooms[thisRoom].spawnQueue) {
                Memory.rooms[thisRoom].spawnQueue = [];
            }
            let spawnParms = Memory.rooms[thisRoom].spawnQueue.pop();
            
            if(spawnParms) {
                
                    delete spawnParms.memory._trav;
                    if(spawnParms.memory.transportCoverage) { 
                        delete spawnParms.memory.transportCoverage
                        delete spawnParms.memory.transportList;
                    }

                    let body = this.getBody(spawnParms);                        
                    
                    if(spawnParms.memory.role == 'builder' && spawnParms.memory.mode == 'roadworker') {
                        body = [CARRY,MOVE,WORK];
                    }
                    
                    if(!spawnParms.memory.homeRoom) {
                        spawnParms.memory.homeRoom = spawn.room.name;
                    }
                    result = spawn.spawnCreep(body,"c"+Math.floor(Math.random() * 65536),spawnParms);

                    if( result == ERR_NOT_ENOUGH_ENERGY && spawnParms.memory.role == "refiller") {
                        body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                        result = spawn.spawnCreep(body,"c"+Math.floor(Math.random() * 65536),spawnParms);
                    }
                    
                    if( result < 0 )
                    {
                        Memory.rooms[thisRoom].spawnQueue.push(spawnParms); //not sure if this patch is needed, thought i had another bug
                        //new RoomVisual(spawn.room.name).text("🚧 "+(result),spawn.pos.x,spawn.pos.y+2);
                    }
                        
            }
            
            // if(result < 0)
            //     console.log("spawner error: "+result);
            
        }
    },
    
    /**
     * Adds spawn request to specified room's spawn queue
     * @param {@Object} parms 
     * @param {string} spawnRoom 
     */
    queueSpawn: function(parms, spawnRoom = 'E38N53') {

        //if neither function parms nor spawn parms contain homeRoom to specify which spawn queue to use, default to first owned room we can find.
        if(!spawnRoom) {
            spawnRoom = parms.memory.homeRoom;
            if(!spawnRoom) {
                spawnRoom = baseCommon.getOwnedRooms()[0];
            }
        }

        /** get a harvester into function, existing queue looks like this;
         * [0] - upgrader
         * [1] - transport
         * [2] - repairer
         * [3] - claimer
         * [4] - refiller
         */

        //initialize spawnQueue for room if variable was undefined
        if( !Memory.rooms[spawnRoom] ) {
            Memory.rooms[spawnRoom] = {};
        }
        if( !Memory.rooms[spawnRoom].spawnQueue ) {
            Memory.rooms[spawnRoom].spawnQueue = []
        }

        var spawnQueue = Memory.rooms[spawnRoom].spawnQueue;
        for(let i = (spawnQueue.length-1); i >= 0; i-- ) {
            let queuedSpawnRequest = spawnQueue[i]; //queuedSpawnRequest is the whole parms json object
            if( this.getSpawnPriority(queuedSpawnRequest.memory.role) > this.getSpawnPriority(parms.memory.role) ) {
                Memory.rooms[spawnRoom].spawnQueue.splice(i,0,parms);
                return;
            }
        }

        //if we get to this point, it means we didn't splice it into spawnQueue and did early return, so it has to go to back of queue;
        Memory.rooms[spawnRoom].spawnQueue.splice(0,0,parms);

        // old code keeping for backup in case above testing fails
        /*
        if(parms.memory.role == 'refiller') {
            Memory.rooms[Memory.homeRoom].spawnQueue.push(parms);
        }
        else if(parms.memory.role == 'attacker'|| parms.memory.role == 'claimer') {
            Memory.rooms[Memory.homeRoom].spawnQueue.push(parms);
        }
        else {
            Memory.rooms[Memory.homeRoom].spawnQueue.splice(0,0,parms);
        }
        */
    },

    /**
     * Helper to re-sort spawn queue for more urgent spawns. Lower number is more urgent
     * @param {string} role 
     */
    getSpawnPriority: function(role) {
        switch(role) {
            case "refiller": return 1;
            case "attacker": return 2;
            case "harvester" : return 3;
            case "claimer": return 4;
            default: return 100;
        }
    },
    
    //TODO this is the wrong way to get homeroom, from creep parms, should be more rational because multiple bases etc.asot
    /**
     * 
     * @param {*} spawnParms 
     * @returns 
     */
    getBody: function(spawnParms) {
        try {
            let homeRoom = spawnParms.memory.homeRoom;
            if(!homeRoom) {
                throw "spawner getBody() can't get homeRoom from spawnParms to measure energyCapacityAvailable";
            }
            let capacity = Game.rooms[homeRoom].energyCapacityAvailable;

            let body = [];
            //each if will catch and return early so rest shouldn't trigger until room is big enough for them
            //RCL 1
            if(capacity < 550) {
                if( spawnParms.memory.role == "harvester" ){
                    //static miner
                    // body = [WORK,WORK,CARRY,MOVE];
                    //default
                    body = [WORK,CARRY,MOVE,MOVE];

                    let harvesters = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "harvester"
                    });

                    if( harvesters && harvesters.length > 0 ) {
                        //default
                        body = [WORK,WORK,CARRY,MOVE];
                    }
                    else {
                        //first harvester
                        body = [WORK,CARRY,MOVE,MOVE];
                    }
                }
                if( spawnParms.memory.role == "transport" ){
                    //TODO manage with state machine so i won't have to calc every time                    
                    //check if first transport or not for startup initialization
                    let transports = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "transport"
                    });

                    if( transports && transports.length > 2 ) {
                        //default
                        body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];
                    }
                    else {
                        //first 3x transports
                        body = [CARRY,MOVE];
                    }

                    //roads
                    //body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "refiller" ){
                    //default
                     body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];             
                }
                if( spawnParms.memory.role == "repairer" ){
                    //default
                     body = [WORK,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "upgrader" || spawnParms.memory.role == "builder" ){
                    //default
                    body = [WORK,CARRY,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,MOVE,MOVE,MOVE,ATTACK];
                }
                return body;
            }
            //RCL 2
            if(capacity < 800) {
                if( spawnParms.memory.role == "harvester" ){
                    //static miner
                    // body = [WORK,WORK,CARRY,MOVE];
                    //default
                    body = [WORK,WORK,WORK,CARRY,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "transport" ){
                    //TODO manage with state machine so i won't have to calc every time
                    //check if first transport or not for startup initialization
                    let transports = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "transport"
                    });

                    if( transports && transports.length > 2 ) {
                        //default
                        body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];
                    }
                    else {
                        //first 3x transports
                        body = [CARRY,MOVE];
                    }

                    //roads
                    //body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "refiller" ){
                    //default
                     body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];           
                }
                if( spawnParms.memory.role == "upgrader" || spawnParms.memory.role == "builder" ){
                    //default
                    body = [WORK,WORK,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "repairer" ){
                    //default
                     body = [WORK,CARRY,MOVE];             
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK];
                }
                return body;

            }
            //RCL 3
            if(capacity < 1300) {
                if( spawnParms.memory.role == "harvester" ){
                    //static miner
                    // body = [WORK,WORK,CARRY,MOVE];
                    //default
                    body = [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "transport" ){
                    //TODO manage with state machine so i won't have to calc every time
                    //check if first transport or not for startup initialization
                    let transports = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "transport"
                    });

                    if( transports && transports.length > 2 ) {
                        //default
                        body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];
                    }
                    else {
                        //first 3x transports
                        body = [CARRY,MOVE];
                    }

                    //roads
                    //body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "refiller" ){
                    //default
                     body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "upgrader" || spawnParms.memory.role == "builder" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "repairer" ){
                    //default
                     body = [WORK,CARRY,MOVE];             
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,HEAL];
                }
                if( spawnParms.memory.role == 'claimer') {
                    //do nothing for now until i can debug why it keeps respawming claimers
                    body = [CLAIM,MOVE];
                }
                return body;

            }
            //RCL 4
            if(capacity < 1800) {
                if( spawnParms.memory.role == "harvester" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "transport" ){
                    //TODO manage with state machine so i won't have to calc every time
                    //check if first transport or not for startup initialization
                    let transports = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "transport"
                    });

                    if( transports && transports.length > 2 ) {
                        //default
                        body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];
                    }
                    else {
                        //first 3x transports
                        body = [CARRY,MOVE];
                    }

                    //roads
                    //body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "refiller" ){
                    //default
                     body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "builder" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "upgrader" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,HEAL];
                }
                if( spawnParms.memory.role == 'claimer') {
                    //do nothing for now until i can debug why it keeps respawming claimers
                    body = [CLAIM,CLAIM,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "repairer" ){
                    //default
                     body = [WORK,CARRY,MOVE];             
                }
                return body;
            }
            //RCL 5
            if(capacity < 2300) {
                if( spawnParms.memory.role == "harvester" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "transport" ){
                    //TODO manage with state machine so i won't have to calc every time
                    //check if first transport or not for startup initialization
                    let transports = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "transport"
                    });

                    if( transports && transports.length > 2 ) {
                        //default
                        body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];
                    }
                    else {
                        //first 3x transports
                        body = [CARRY,MOVE];
                    }

                    //roads
                    //body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "refiller" ){
                    //default
                     body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "builder" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "upgrader" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,HEAL];
                }                            
                if( spawnParms.memory.role == 'claimer') {
                    //do nothing for now until i can debug why it keeps respawming claimers
                    body = [CLAIM,CLAIM,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "repairer" ){
                    //default
                     body = [WORK,CARRY,MOVE];             
                }
                return body;

            }
            //RCL 6
            if(capacity < 5600) {
                if( spawnParms.memory.role == "harvester" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "transport" ){
                    //TODO manage with state machine so i won't have to calc every time
                    //check if first transport or not for startup initialization
                    let transports = _.filter( Game.creeps, (creep) => {
                        return creep.memory.role == "transport"
                    });

                    if( transports && transports.length > 2 ) {
                        //default
                        body = [CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE,CARRY,MOVE];
                    }
                    else {
                        //first 3x transports
                        body = [CARRY,MOVE];
                    }

                    //roads
                    //body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "refiller" ){
                    //default
                     body = [CARRY,CARRY,MOVE,CARRY,CARRY,MOVE,CARRY,CARRY,MOVE];
                }
                if( spawnParms.memory.role == "upgrader" || spawnParms.memory.role == "builder" ){
                    //default
                    body = [WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,HEAL];
                }                            
                if( spawnParms.memory.role == 'claimer') {
                    //do nothing for now until i can debug why it keeps respawming claimers
                    body = [CLAIM,CLAIM,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "repairer" ){
                    //default
                     body = [WORK,CARRY,MOVE];             
                }
                return body;

            }
            //RCL 7
            if(capacity = 5600) {

            }
            //RCL 8
            if(capacity = 13000) {

            }

            
        }
        catch( problem ) {

        }
        
    }
}

module.exports = baseCommon;