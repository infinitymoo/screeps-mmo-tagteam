/**
 * Limitations
 * 
 */

/**
 * Summarized Behaviour
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

                    let body = this.getBody(spawnParms);                        
                    
                    if(spawnParms.memory.role == 'builder' && spawnParms.memory.mode == 'roadworker') {
                        body = [CARRY,MOVE,WORK];
                    }
                    
                    if(!spawnParms.memory.homeRoom) {
                        spawnParms.memory.homeRoom = spawn.room.name;
                    }
                    result = spawn.spawnCreep(body,"c"+Math.floor(Math.random() * 65536),spawnParms);
                    
                    if( result < 0 )
                    {
                        Memory.rooms[thisRoom].spawnQueue.push(spawnParms); //not sure if this patch is needed, thought i had another bug
                        new RoomVisual(spawn.room.name).text("🚧 "+(result),spawn.pos.x,spawn.pos.y+2);
                    }
                        
            }
            
            // if(result < 0)
            //     console.log("spawner error: "+result);
            
        }
    },
    
    //TODO this is the wrong way to get homeroom, from creep parms, should be more rational because multiple bases etc.
    queueSpawn: function(parms) {
        if( !Memory.rooms[Memory.homeRoom] ) {
            Memory.rooms[Memory.homeRoom] = {};
        }
        console.log(`queueSpawn Memory.rooms ${JSON.stringify(Memory.rooms)}`);
        console.log(`queueSpawn homeRoom ${JSON.stringify(Memory.homeRoom)}`);
        if( !Memory.rooms[Memory.homeRoom].spawnQueue ) {
            Memory.rooms[Memory.homeRoom].spawnQueue = []
        }
        
        //TODO i don't think roadworkers should be prioritized, rest makes sense e.g. spawning ability and defense
        if(parms.memory.role == 'refiller' || parms.memory.role == 'attacker'|| parms.memory.role == 'roadworker') {
            Memory.rooms[Memory.homeRoom].spawnQueue.push(parms);
        }
        else {
            Memory.rooms[Memory.homeRoom].spawnQueue.splice(0,0,parms);
        }
    },
    
    //TODO this is the wrong way to get homeroom, from creep parms, should be more rational because multiple bases etc.asot
    getBody: function(spawnParms) {
        try {
            let homeRoom = Memory.homeRoom;
            if(!homeRoom) {
                throw "spawner getBody() can't get homeRoom from spawnParms to measure energyCapacityAvailable";
            }
            let capacity = Game.rooms[homeRoom].energyCapacityAvailable;

            let body = [];
            //each if will catch and return early so rest shouldn't trigger until room is big enough for them
            //RCL 1
            if(capacity <= 300) {
                if( spawnParms.memory.role == "harvester" ){
                    //static miner
                    // body = [WORK,WORK,CARRY,MOVE];
                    //default
                    body = [WORK,CARRY,MOVE,MOVE];
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
            if(capacity <= 550) {
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
                    body = [WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK];
                }
                return body;

            }
            //RCL 3
            if(capacity <= 800) {
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
                    body = [WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,HEAL];
                }
                return body;

            }
            //RCL 4
            if(capacity <= 1300) {
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
                    body = [WORK,WORK,WORK,CARRY,MOVE,MOVE,MOVE,MOVE];
                }
                if( spawnParms.memory.role == "attacker" ){
                    //default
                     body = [TOUGH,TOUGH,TOUGH,TOUGH,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,MOVE,ATTACK,ATTACK,HEAL];
                }                            
                if( spawnParms.memory.role == 'claimer') {
                    body = [CLAIM,CLAIM,MOVE,MOVE];
                }
                return body;
            }
            //RCL 5
            if(capacity <= 1800) {

            }
            //RCL 6
            if(capacity <= 2300) {

            }
            //RCL 7
            if(capacity <= 5600) {

            }
            //RCL 8
            if(capacity <= 13000) {

            }

            
        }
        catch( problem ) {

        }
        
    },
    
    getBodyCost: function(spawnParms,max) {
        try{ 
            // let body = [];
            // let role = spawnParms.memory.role;
            
            // if(!role)
            //     throw spawnParms;
            
            // switch(role) {
                
            // }
            
            // BODYPART_COST
        }
        catch( problem ) {
            console.log(`spawner.getBodyCost couldn't get role from spawnParms: ${JSON.stringify(problem)}'`);
        }
    }
}

module.exports = spawner;