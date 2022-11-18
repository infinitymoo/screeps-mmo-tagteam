var taskCommon = require('task.common');
var u = require('util.common');

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0 && !(creep.memory.targetRoom && creep.memory.targetRoom != creep.room.name )) {
                creep.memory.building = false;
                creep.say('🔄');
            }
            if((!creep.memory.building && creep.store[RESOURCE_ENERGY] != 0) && (!creep.memory.hasHarvested || creep.memory.hasHarvested == 0 || creep.store.getFreeCapacity() == 0)) {
                delete creep.memory.hasHarvested;
                delete creep.memory.source;
                creep.memory.building = true;
                creep.say('🚧');
            }
                
            if (creep.memory.targetRoom && creep.room.name == creep.memory.targetRoom && (creep.pos.x == 0 || creep.pos.x == 49) || (creep.pos.y == 0 || creep.pos.y == 49)) {
                var destRoom = new RoomPosition(25,25,creep.memory.targetRoom );
                creep.Move(destRoom, {ignoreCreeps:false,swampCost:1,range:10});
                u.debug(creep.pos,`builder stuck ${creep.name}`);
                return;
            }
    
            if(creep.memory.building) {
                
                let targetRoom = creep.memory.targetRoom;
                let targetLock = creep.memory.targetLock;
                let target = Game.getObjectById(targetLock);

                //clear target if its not in the room we need to be in just in case we get assigned a target outside of our target area
                if(target && target.room.name != targetRoom) {
                    delete creep.memory.targetLock;
                    delete creep.memory.target;
                    target = false;
                }

                if(!targetRoom) {
                    //if we can see target, it means we can set targetRoom from it
                    if( target ) {
                        targetRoom = target.room.name;
                        creep.memory.targetRoom = targetRoom;
                    }
                }

                if(!target && creep.memory.targetRoom && creep.room.name != creep.memory.targetRoom) {
                    var destRoom = new RoomPosition(25,25,creep.memory.targetRoom );
                    creep.Move(destRoom, {ignoreCreeps:false,swampCost:1,range:10});
                }
                        
                if(target && targetRoom && (creep.room.name == targetRoom)) {
                    var result = creep.build(target);

                    try {

                        if(result == ERR_INVALID_TARGET) {
                            delete creep.memory.targetLock;
                        }

                        if(result == ERR_NOT_IN_RANGE) {
                            creep.Move(
                                new RoomPosition(
                                    target.pos.x,
                                    target.pos.y,
                                    targetRoom),
                                { ignoreCreeps:false,
                                range:3,
                                reusePath:10});
                        }
                    }
                    catch(problem) {
                        console.log(`Exception builder: ${problem.name}: ${problem.message} ${problem.stack}  `);
                    }
                    
                    //this check prevents getting stuck on room borders if not moving off them with early return
                    if(target && target.room.name == creep.room.name)
                        return;
                }
                else if(targetRoom && (creep.room.name != targetRoom)) {
                    var destRoom = new RoomPosition(25,25,targetRoom);
                    creep.Move(destRoom, {ignoreCreeps:false,swampCost:1,range:10,allowSK:true});

                    return;
                }
                //no targets set and we're in same room as we think we should be, so look for sites to build
                else {
                
                    if(!target ) {
                        var buildSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
                    
                        if(buildSite) {
                            delete creep.memory.target; //used in repair
                            targetLock = buildSite.id;
                            target = Game.getObjectById(targetLock);
                            
                            creep.memory.targetLock = targetLock;
                            creep.memory.targetRoom = target.room.name;
                        }
                    }
                    /*
                    var buildSites = Game.rooms[creep.room.name].find(FIND_CONSTRUCTION_SITES);
                    if(buildSites.length > 0) {
                        target = buildSites[0];
                        creep.memory.target = target;
                    }
                    */
                }
                
                //defaulting behaviour
                if(!target) {

                    this.doRepair(creep);
                }
                
            }
            else { //TODO roadworkers sometimes get stuck on room edges sometimes no idea how/why, must still debug that.

                var source = Game.getObjectById(creep.memory.source);

                if( !source ) {
                    source = taskCommon.getClosestAvailableEnergy(creep);
                    if( source )
                        creep.memory.source = source.id;
                }


                var collectionMethod;

                if(source instanceof Structure)
                    collectionMethod = "structure";
                else
                    collectionMethod = "source";
                
                if(source) {                        
                    var result;
                    if(collectionMethod == "structure")
                        result = creep.withdraw(source,RESOURCE_ENERGY);
                    else
                        result = creep.pickup(source,RESOURCE_ENERGY);
                    
                    if(result == ERR_NOT_IN_RANGE) {
                        creep.Move(source,{ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                    }
                    if( result == OK ) {
                        delete creep.memory.source;
                    }
                    return;
                }
                else {
                    source = creep.pos.findClosestByRange(FIND_SOURCES);
                    var harvestResult = creep.harvest(source);
                    if( harvestResult == ERR_NOT_IN_RANGE) {
                        creep.Move(source, {ignoreCreeps: false,range:1,maxRooms:1,reusePath:8});
                    }
                    if( harvestResult == OK ) { // TODO calc harvest count to fill dont hardcode
                        if(creep.memory.hasHarvested && creep.memory.hasHarvested > 0) {
                            creep.memory.hasHarvested--;
                        }
                        else {
                            let capacity = creep.store.getFreeCapacity();
                            let workParts = _.filter(creep.body, function(b) {return b.type == WORK});
                            let harvestRate = workParts.length*2;
                            creep.memory.hasHarvested = capacity/(harvestRate*2);
                        }
                    }
                }
            }
        }
        catch (problem) {
            console.log(`Exception builder: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    },

    doRepair: function(creep) {

        //Validate
        let repairTarget = Game.getObjectById( creep.memory.repairTarget );
        
        if( !creep.memory.targetRoom ) {
            creep.memory.targetRoom = creep.memory.homeRoom;
        }

        if( repairTarget && repairTarget.room.name != creep.memory.targetRoom ) {
            delete creep.memory.repairTarget;
        }

        if( !repairTarget && creep.memory.targetRoom == creep.room.name ) {

            let nextTargetId = this.getRoomRepairTarget( creep, creep.room.name, creep.memory.repairTarget );
            let repairTarget = Game.getObjectById( nextTargetId );
            if( repairTarget ) {
                
                creep.memory.repairTarget = nextTargetId;
            }
        }

        // Execute
        let repairDone = false;
        if( repairTarget ) {

            if( (repairTarget.structureType == STRUCTURE_RAMPART || repairTarget.structureType == STRUCTURE_WALL) ) {

                let targetLevel = this.calcBorderTargetLevels( repairTarget.hits );
                if( repairTarget.hits < targetLevel ) {

                    this.continueRepair( creep, repairTarget );
                    return;
                }
                else {

                    repairDone = true;
                }
            }
            else if( repairTarget.structureType == STRUCTURE_ROAD || repairTarget.structureType == STRUCTURE_CONTAINER ) {

                let lastTarget = Game.getObjectById( creep.memory.repairTarget );

                if( lastTarget.hits < lastTarget.hitsMax ) {

                    this.continueRepair( creep, repairTarget );
                    return;
                }
                else {

                    repairDone = true;
                }
            }
        }

        if( repairDone ) {
            let nextTargetId = this.getRoomRepairTarget( creep, creep.room.name, creep.memory.repairTarget );
            let repairTarget = Game.getObjectById( nextTargetId );
            if( repairTarget ) {
                
                creep.memory.repairTarget = nextTargetId;
            }
        }


        if( !repairTarget && creep.room.controller && creep.room.controller.owner && creep.room.controller.my ) {

            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {

                creep.Move(creep.room.controller, {ignoreCreeps: false,range:3,maxRooms:1});
            }
        }

    },

    continueRepair( creep, target ) {

        let result;
        if( creep.pos.inRangeTo( target.pos, 3 )) {

            result = creep.repair(target);
            
            if(result == OK)
                return;                        
        }
        else {
            
            creep.Move(target, {ignoreCreeps: false,range:3,maxRooms:1});
            return;
        }
    },

    getRoomRepairTarget( creep, roomName, lastRepairTarget ) {

        if( !Memory.repairLookup ) Memory.repairLookup = {};

        if( !Memory.repairLookup[ roomName ] ) {

            Memory.repairLookup[ roomName ] = {};
            if( !Memory.rooms[ roomName ] )
                Memory.rooms[ roomName ] = {};
        }

        if( !Memory.rooms[ roomName ].repairUpdated ) {
            Memory.rooms[ roomName ].repairUpdated = Game.time;
            this.initRoomRepairTargets( creep, roomName );
        }

        if( Memory.rooms[ roomName ].repairUpdated >= Game.time + 1500 ) {

            Memory.rooms[ roomName ].repairUpdated = Game.time;
            this.initRoomRepairTargets( creep, roomName );
        }

        let repairTarget;
        let lastRepairTargetIndex = Memory.repairLookup[ roomName ].length;

        if( _.isUndefined( lastRepairTarget ) ) {

            for( let i = 0; i < Memory.repairLookup[ roomName ].length; i ++ ) {

                let repairCandidate = Game.getObjectById( Memory.repairLookup[ roomName ][i] );
                if( repairCandidate && repairCandidate.hits < repairCandidate.hitsMax ) {
                    repairTarget = repairCandidate.id;
                    break;
                }
            }
        }

        for( let i = 0; i < Memory.repairLookup[ roomName ].length; i ++ ) {

            if( Memory.repairLookup[ roomName ][i] == lastRepairTarget ) {
                lastRepairTargetIndex = i;
                if( lastRepairTargetIndex >= Memory.repairLookup[ roomName ].length )
                    delete creep.memory.repairTarget;
            }

            if( i >= lastRepairTargetIndex ) {

                let repairCandidate = Game.getObjectById( Memory.repairLookup[ roomName ][i] );
                if( repairCandidate && repairCandidate.hits < repairCandidate.hitsMax ) {
                    repairTarget = repairCandidate.id;
                    break;
                }
            }
        };

        return repairTarget;
    },

    initRoomRepairTargets( creep, roomName ) {

        let isOwner = false;
        if( Game.rooms[ roomName ].controller.owner && Game.rooms[ roomName ].controller.my)
            isOwner = true;
            
        u.debug( roomName, `initRoomRepairTargets`);
        //finds are expensive, so do it once and then filter out into other variables how we want to use it.
        let repairTargets = creep.room.find( FIND_STRUCTURES, {

            filter: (structure) => {
                return structure.structureType == STRUCTURE_CONTAINER ||
                structure.structureType == STRUCTURE_ROAD ||
                ( (structure.structureType == STRUCTURE_RAMPART || structure.structureType == STRUCTURE_WALL) && isOwner );
        }});

        let borders = _.filter( repairTargets, (repairTarget) => {
            return repairTarget.structureType == STRUCTURE_RAMPART || repairTarget.structureType == STRUCTURE_WALL;
        });

        let roads = _.filter( repairTargets, (repairTarget) => {
            return repairTarget.structureType == STRUCTURE_ROAD;
        });


        let containers = _.filter( repairTargets, (repairTarget) => {
            return repairTarget.structureType == STRUCTURE_CONTAINER;
        });

        let sortedBorders = _.sortBy( borders, 'hits' );
        let sortedRoads = this.sortByRoomPosition( roads );
        let sortedContainers = _.sortBy( containers, 'hits' );
        
        let compiledTargets = [];

        _.forEach( sortedRoads, (sortedItem) => { compiledTargets.push( sortedItem.id ) });
        _.forEach( sortedContainers, (sortedItem) => { compiledTargets.push( sortedItem.id ) });
        _.forEach( sortedBorders, (sortedItem) => { compiledTargets.push( sortedItem.id ) });

        Memory.repairLookup[ roomName ] = compiledTargets;
    },

    //needs .pos attribute
    sortByRoomPosition( roomObjectsArray ) {
        roomObjectsArray.sort( function ( a, b ) {

            var n = a.pos.x - b.pos.x;
            if (n !== 0) {
                return n;
            }
        
            return a.pos.y - b.pos.y;
        });

        return roomObjectsArray;
    },

    calcBorderTargetLevels(currentLevel) {

        if( currentLevel < 200000)
            return 300000;

        if( currentLevel < 800000)
            return 1000000;

        if( currentLevel < 2500000)
            return 3000000;

        if( currentLevel < 5000000)
            return 7000000;
            
        if( currentLevel < 10000000)
            return 12000000;

        if( currentLevel < 18000000)
            return 20000000;

        if( currentLevel < 48000000)
            return 50000000;

        if( currentLevel < 98000000)
            return 100000000;
    }
};

module.exports = roleBuilder;